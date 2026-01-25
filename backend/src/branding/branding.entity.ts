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

  @Column({ default: 'AVR Admin' })
  appName: string;

  @Column({ default: 'AVR Admin Panel' })
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

  @Column({ default: 'https://discord.gg/DFTU69Hg74' })
  discordUrl: string;

  @Column({ default: 'https://github.com/orgs/agentvoiceresponse/repositories' })
  githubUrl: string;

  @Column({ default: 'https://wiki.agentvoiceresponse.com/' })
  wikiUrl: string;

  @Column({ nullable: true })
  loginTitle: string | null;

  @Column({ nullable: true })
  loginDescription: string | null;

  @Column({ default: 'AVR Phone' })
  webrtcPhoneTitle: string;

  @CreateDateColumn({ type: 'datetime' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'datetime' })
  updatedAt: Date;
}
