import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity()
export class Branding {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ default: 'Digital Storming' })
  appName: string;

  @Column({ default: 'Digital Storming Admin' })
  panelName: string;

  @Column({ nullable: true })
  logoUrl: string | null;

  @Column({ nullable: true })
  faviconUrl: string | null;

  @Column({ nullable: true })
  primaryColor: string | null;

  @Column({ nullable: true })
  secondaryColor: string | null;

  @Column({ nullable: true })
  accentColor: string | null;

  @Column({ nullable: true })
  destructiveColor: string | null;

  @Column({ default: 'https://digitalstorming.com' })
  discordUrl: string;

  @Column({ default: 'https://digitalstorming.com' })
  githubUrl: string;

  @Column({ default: 'https://digitalstorming.com' })
  wikiUrl: string;

  @Column({ nullable: true })
  loginTitle: string | null;

  @Column({ nullable: true })
  loginDescription: string | null;

  @Column({ default: 'Digital Storming Phone' })
  webrtcPhoneTitle: string;

  @CreateDateColumn({ type: 'datetime' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'datetime' })
  updatedAt: Date;
}
