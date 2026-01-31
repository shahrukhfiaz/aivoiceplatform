# Digital Storming AI - Admin panel

[![Discord](https://img.shields.io/discord/1347239846632226998?label=Discord&logo=discord)](https://discord.gg/DFTU69Hg74)
[![GitHub Repo stars](https://img.shields.io/github/stars/agentvoiceresponse/dsai-app?style=social)](https://github.com/agentvoiceresponse/dsai-app)
[![Ko-fi](https://img.shields.io/badge/Support%20us%20on-Ko--fi-ff5e5b.svg)](https://ko-fi.com/agentvoiceresponse)


Repository for the DSAI administration panel composed of:

- `backend/`: NestJS API (TypeORM + SQLite, JWT, Docker management)
[![Docker Pulls](https://img.shields.io/docker/pulls/agentvoiceresponse/dsai-app-backend?label=Docker%20Pulls&logo=docker)](https://hub.docker.com/r/agentvoiceresponse/dsai-app-backend)

- `frontend/`: Next.js 14 interface with Tailwind CSS, shadcn/ui and light/dark mode
[![Docker Pulls](https://img.shields.io/docker/pulls/agentvoiceresponse/dsai-app-frontend?label=Docker%20Pulls&logo=docker)](https://hub.docker.com/r/agentvoiceresponse/dsai-app-frontend)

- `docker-compose.yml`: orchestrates backend and frontend services

## Requirements

- Node.js 18+
- npm 9+
- Docker Engine (required to run agent containers)
- Asterisk PBX (required onfly for telephony sections)

## Local Development

Backend:

```bash
cd backend
npm install
npm run start:dev
```

Frontend:

```bash
cd frontend
npm install
npm run dev
```

## Data structure

- SQLite database mounted in `./data` (volume shared by the containers)
- JWT signed with `JWT_SECRET`, configurable in `docker-compose.yml`

See `backend/README.md` and `frontend/README.md` for more details on each project.

## Usage

Enjoy the Digital Storming AI experience! After installation, you can access the application through your browser.

<div align="center">
  <img src="https://github.com/agentvoiceresponse/.github/blob/main/profile/images/dsai-dashboard-new.png" alt="Dashboard" width="600">
  <br>
  <em>The intuitive dashboard for managing your voice response agents</em>
</div>

## Support & Community

*   **GitHub:** [https://github.com/agentvoiceresponse](https://github.com/agentvoiceresponse) - Report issues, contribute code.
*   **Discord:** [https://discord.gg/DFTU69Hg74](https://discord.gg/DFTU69Hg74) - Join the community discussion.
*   **Docker Hub:** [https://hub.docker.com/u/agentvoiceresponse](https://hub.docker.com/u/agentvoiceresponse) - Find Docker images.
*   **Wiki:** [https://wiki.agentvoiceresponse.com/en/home](https://wiki.agentvoiceresponse.com/en/home) - Project documentation and guides.

## Support DSAI

DSAI is free and open-source. If you find it valuable, consider supporting its development:

<a href="https://ko-fi.com/agentvoiceresponse" target="_blank"><img src="https://ko-fi.com/img/githubbutton_sm.svg" alt="Support us on Ko-fi"></a>

## License

MIT License - see the [LICENSE](LICENSE.md) file for details.
