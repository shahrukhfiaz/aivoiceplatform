import { IsOptional, IsString, IsUrl } from 'class-validator';

export class UpdateBrandingDto {
  @IsOptional()
  @IsString()
  appName?: string;

  @IsOptional()
  @IsString()
  panelName?: string;

  @IsOptional()
  @IsString()
  logoUrl?: string | null;

  @IsOptional()
  @IsString()
  faviconUrl?: string | null;

  @IsOptional()
  @IsString()
  primaryColor?: string | null;

  @IsOptional()
  @IsString()
  secondaryColor?: string | null;

  @IsOptional()
  @IsString()
  accentColor?: string | null;

  @IsOptional()
  @IsString()
  destructiveColor?: string | null;

  @IsOptional()
  @IsUrl()
  discordUrl?: string;

  @IsOptional()
  @IsUrl()
  githubUrl?: string;

  @IsOptional()
  @IsUrl()
  wikiUrl?: string;

  @IsOptional()
  @IsString()
  loginTitle?: string | null;

  @IsOptional()
  @IsString()
  loginDescription?: string | null;

  @IsOptional()
  @IsString()
  webrtcPhoneTitle?: string;
}
