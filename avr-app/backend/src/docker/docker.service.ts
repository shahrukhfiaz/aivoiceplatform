import {
  Injectable,
  Logger,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import Dockerode from 'dockerode';

@Injectable()
export class DockerService {
  private readonly docker: Dockerode;
  private readonly logger = new Logger(DockerService.name);

  constructor() {
    // On Windows, dockerode automatically uses named pipe if socketPath is not provided
    // On Linux/Mac, use /var/run/docker.sock
    let dockerConfig: Dockerode.DockerOptions;
    
    if (process.env.DOCKER_SOCKET_PATH) {
      dockerConfig = { socketPath: process.env.DOCKER_SOCKET_PATH };
    } else if (process.platform === 'win32') {
      // Windows: auto-detect named pipe
      dockerConfig = {};
    } else {
      // Linux/Mac: explicitly use Unix socket
      dockerConfig = { socketPath: '/var/run/docker.sock' };
    }
    
    this.logger.log(`Initializing Docker client with config: ${JSON.stringify(dockerConfig)}`);
    this.logger.log(`DOCKER_SOCKET_PATH env: ${process.env.DOCKER_SOCKET_PATH || 'not set'}`);
    this.logger.log(`Platform: ${process.platform}`);
    this.docker = new Dockerode(dockerConfig);
  }

  async runContainer(
    name: string,
    image: string,
    env: string[] = [],
    binds: string[] = [],
  ): Promise<string> {
    // Always check for local :local version first (for development/testing)
    // If image is "image:tag" or "image", check for "image:local"
    let imageToUse = image;
    const localImage = image.includes(':') 
      ? image.replace(/:[^:]+$/, ':local')  // Replace last tag with :local
      : `${image}:local`;  // Add :local if no tag
    
    this.logger.debug(`Checking for local image: ${localImage} (original: ${image})`);
    if (localImage !== image) {
      try {
        const localImg = this.docker.getImage(localImage);
        await localImg.inspect();
        imageToUse = localImage;
        this.logger.log(`✅ Using local image ${localImage} instead of ${image}`);
      } catch (error) {
        // Local image doesn't exist, use original
        this.logger.debug(`Local image ${localImage} not found (${error.message}), using ${image}`);
        imageToUse = image;
      }
    }
    
    await this.pullImage(imageToUse);
    const existing = await this.findContainerByName(name);
    if (existing) {
      const container = this.docker.getContainer(existing.Id);
      const details = await container.inspect();
      if (!details.State.Running) {
        try {
          await container.start();
          this.logger.debug(`Started existing container ${name}`);
          return existing.Id;
        } catch (error: any) {
          // If container fails to start (e.g., user mapping issue), remove and recreate
          this.logger.warn(`Failed to start existing container ${name}, removing and recreating: ${error.message}`);
          try {
            await container.remove({ force: true });
          } catch (removeError) {
            this.logger.warn(`Failed to remove container ${name}: ${removeError}`);
          }
          // Continue to create new container below
        }
      } else {
        return existing.Id;
      }
    }

    const container = await this.docker.createContainer({
      name,
      Image: imageToUse,
      Env: env,
      Labels: this.getDefaultLabels(name),
      // Override USER directive from Dockerfile to run as root
      // This fixes "unable to find user node" errors on Windows Docker
      User: 'root',
      NetworkingConfig: {
        EndpointsConfig: {
          dsai: {},
        },
      },
      HostConfig: {
        Binds: binds,
      }
    });
    await container.start();
    this.logger.debug(`Created and started container ${name}`);

    // Also connect to 'avr' network so backend can reach the container
    try {
      const avrNetwork = this.docker.getNetwork('avr');
      await avrNetwork.connect({ Container: container.id });
      this.logger.debug(`Connected container ${name} to avr network`);
    } catch (error: any) {
      this.logger.warn(`Failed to connect ${name} to avr network: ${error.message}`);
    }

    return container.id;
  }

  async stopContainer(name: string): Promise<void> {
    const existing = await this.findContainerByName(name);
    if (!existing) {
      this.logger.warn(`Container ${name} not found`);
      return;
    }

    const container = this.docker.getContainer(existing.Id);
    const details = await container.inspect();
    if (details.State.Running) {
      await container.stop();
      await container.remove();
      this.logger.debug(`Stopped container ${name}`);
    }
  }

  async listContainers(agentId: string): Promise<any[]> {
    return this.docker.listContainers({
      all: true,
      filters: { name: [agentId] },
    });
  }

  async listAllContainers(): Promise<Dockerode.ContainerInfo[]> {
    try {
      // List all containers first, then filter in code if needed
      // This avoids issues with Docker API filter format
      const allContainers = await this.docker.listContainers({ all: true });
      this.logger.debug(`Found ${allContainers.length} total containers`);
      
      // Filter by label if specified, otherwise return all
      const labelFilters = this.getDefaultLabelFilters();
      if (labelFilters.length > 0) {
        const filtered = allContainers.filter((container) => {
          const labels = container.Labels || {};
          return labelFilters.some((filter) => {
            const [key, value] = filter.split('=');
            return labels[key] === value;
          });
        });
        this.logger.debug(`Filtered to ${filtered.length} containers with labels: ${labelFilters.join(', ')}`);
        return filtered;
      }
      
      return allContainers;
    } catch (error) {
      this.logger.error(`Error listing containers: ${error.message}`, error.stack);
      throw new InternalServerErrorException(`Failed to list containers: ${error.message}`);
    }
  }

  async getContainerInspect(
    containerId: string,
  ): Promise<Dockerode.ContainerInspectInfo> {
    try {
      const container = this.docker.getContainer(containerId);
      return await container.inspect();
    } catch (error) {
      this.logger.warn(`Container ${containerId} not found`);
      throw new NotFoundException('Container not found');
    }
  }

  async startContainer(containerId: string): Promise<void> {
    const container = this.docker.getContainer(containerId);
    try {
      const inspect = await container.inspect();
      if (inspect.Config?.Image) {
        await this.pullImage(inspect.Config.Image);
      }
      if (!inspect.State.Running) {
        await container.start();
        this.logger.debug(`Started container ${containerId}`);
      }
    } catch (error: any) {
      if (error?.statusCode === 404) {
        throw new NotFoundException('Container not found');
      }
      this.logger.error(
        `Unable to start container ${containerId}`,
        error as Error,
      );
      throw new InternalServerErrorException('Unable to start container');
    }
  }

  async stopContainerById(containerId: string): Promise<void> {
    const container = this.docker.getContainer(containerId);
    try {
      const inspect = await container.inspect();
      if (inspect.State.Running) {
        await container.stop();
        this.logger.debug(`Stopped container ${containerId}`);
      }
    } catch (error: any) {
      if (error?.statusCode === 404) {
        throw new NotFoundException('Container not found');
      }
      this.logger.error(
        `Unable to stop container ${containerId}`,
        error as Error,
      );
      throw new InternalServerErrorException('Unable to stop container');
    }
  }

  async pullAndRestartContainer(containerId: string): Promise<void> {
    const container = this.docker.getContainer(containerId);
    try {
      const inspect = await container.inspect();
      const image = inspect.Config?.Image;
      if (!image) {
        throw new InternalServerErrorException('Container image not available');
      }

      await this.pullImage(image);

      if (inspect.State.Running) {
        try {
          await container.stop();
          await container.wait({ condition: 'not-running' });
        } catch (stopError: any) {
          if (stopError?.statusCode !== 304 && stopError?.statusCode !== 409) {
            throw stopError;
          }
          this.logger.debug(
            `Container ${containerId} already stopped while refreshing image`,
          );
        }
      }

      try {
        await container.start();
      } catch (startError: any) {
        if (startError?.statusCode === 304 || startError?.statusCode === 409) {
          this.logger.debug(
            `Container ${containerId} already running after refresh request`,
          );
        } else {
          throw startError;
        }
      }
      this.logger.debug(`Pulled image and restarted container ${containerId}`);
    } catch (error: any) {
      if (error instanceof InternalServerErrorException) {
        throw error;
      }

      if (error?.statusCode === 404) {
        throw new NotFoundException('Container not found');
      }

      this.logger.error(
        `Unable to pull and restart container ${containerId}`,
        error as Error,
      );
      const errorMessage =
        error instanceof Error && error.message
          ? error.message
          : 'Unable to refresh container';
      throw new InternalServerErrorException(errorMessage);
    }
  }

  async getContainerLogs(containerId: string, tail = 200): Promise<string> {
    const container = this.docker.getContainer(containerId);
    try {
      const logs = await container.logs({
        stdout: true,
        stderr: true,
        tail,
        timestamps: true,
        follow: false,
      });
      return logs.toString('utf-8');
    } catch (error: any) {
      if (error?.statusCode === 404) {
        throw new NotFoundException('Container not found');
      }
      this.logger.error(
        `Unable to fetch logs for container ${containerId}`,
        error as Error,
      );
      throw new InternalServerErrorException('Unable to fetch container logs');
    }
  }

  private async findContainerByName(name: string) {
    const containers = await this.docker.listContainers({
      all: true,
      filters: { name: [name] },
    });
    return containers.length > 0 ? containers[0] : null;
  }

  private getDefaultLabels(name: string): Record<string, string> {
    const labels: Record<string, string> = {
      agentName: name,
      app: 'dsai',
    };
    const tenant = process.env.TENANT;
    if (tenant) {
      labels.tenant = tenant;
    }
    return labels;
  }

  private getDefaultLabelFilters(): string[] {
    // Only filter by app=dsai to show all dsai containers
    // Tenant filtering is optional and should not exclude containers without tenant label
    return ['app=dsai'];
  }

  private async pullImage(image: string): Promise<void> {
    // Skip pulling for local development images (tagged with :local)
    if (image.endsWith(':local')) {
      this.logger.debug(`Skipping pull for local image ${image}`);
      return;
    }
    
    // Check if local :local version exists and use it instead of pulling
    const localImage = image.replace(/:latest$/, ':local').replace(/:$/, ':local');
    if (localImage !== image) {
      try {
        const localImg = this.docker.getImage(localImage);
        await localImg.inspect();
        this.logger.debug(`Using local image ${localImage} instead of pulling ${image}`);
        return; // Use local image, don't pull
      } catch {
        // Local image doesn't exist, continue to pull
        this.logger.debug(`Local image ${localImage} not found, will pull ${image}`);
      }
    }
    
    this.logger.debug(`Pulling image ${image}`);
    return new Promise((resolve, reject) => {
      this.docker.pull(image, (error, stream) => {
        if (error) {
          this.logger.error(`Failed to pull image ${image}`, error as Error);
          return reject(error);
        }

        this.docker.modem.followProgress(stream, (progressError) => {
          if (progressError) {
            this.logger.error(
              `Error while pulling image ${image}`,
              progressError as Error,
            );
            reject(progressError);
          } else {
            this.logger.debug(`Image ${image} pulled successfully`);
            resolve();
          }
        });
      });
    });
  }
}
