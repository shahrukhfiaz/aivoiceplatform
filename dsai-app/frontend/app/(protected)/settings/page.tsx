'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Save, CheckCircle2, AlertCircle } from 'lucide-react';
import { apiFetch, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useBranding } from '@/lib/branding';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const brandingSchema = z.object({
  appName: z.string().min(1, 'App name is required'),
  panelName: z.string().min(1, 'Panel name is required'),
  logoUrl: z.string().optional(),
  faviconUrl: z.string().optional(),
  primaryColor: z.string().optional(),
  secondaryColor: z.string().optional(),
  accentColor: z.string().optional(),
  destructiveColor: z.string().optional(),
  discordUrl: z.string().url('Must be a valid URL').optional(),
  githubUrl: z.string().url('Must be a valid URL').optional(),
  wikiUrl: z.string().url('Must be a valid URL').optional(),
  loginTitle: z.string().optional(),
  loginDescription: z.string().optional(),
  webrtcPhoneTitle: z.string().min(1, 'WebRTC phone title is required'),
});

type BrandingFormValues = z.infer<typeof brandingSchema>;

export default function SettingsPage() {
  const { user } = useAuth();
  const { branding, refresh } = useBranding();
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const form = useForm<BrandingFormValues>({
    resolver: zodResolver(brandingSchema),
    defaultValues: {
      appName: 'Digital Storming',
      panelName: 'Digital Storming',
      logoUrl: '',
      faviconUrl: '',
      primaryColor: '',
      secondaryColor: '',
      accentColor: '',
      destructiveColor: '',
      discordUrl: 'https://discord.gg/DFTU69Hg74',
      githubUrl: 'https://github.com/orgs/agentvoiceresponse/repositories',
      wikiUrl: 'https://wiki.agentvoiceresponse.com/',
      loginTitle: 'Digital Storming',
      loginDescription: '',
      webrtcPhoneTitle: 'Phone',
    },
  });

  useEffect(() => {
    if (branding) {
      form.reset({
        appName: branding.appName || 'Digital Storming',
        panelName: branding.panelName || 'Digital Storming',
        logoUrl: branding.logoUrl || '',
        faviconUrl: branding.faviconUrl || '',
        primaryColor: branding.primaryColor || '',
        secondaryColor: branding.secondaryColor || '',
        accentColor: branding.accentColor || '',
        destructiveColor: branding.destructiveColor || '',
        discordUrl: branding.discordUrl || 'https://discord.gg/DFTU69Hg74',
        githubUrl: branding.githubUrl || 'https://github.com/orgs/agentvoiceresponse/repositories',
        wikiUrl: branding.wikiUrl || 'https://wiki.agentvoiceresponse.com/',
        loginTitle: branding.loginTitle || 'Digital Storming',
        loginDescription: branding.loginDescription || '',
        webrtcPhoneTitle: branding.webrtcPhoneTitle || 'Phone',
      });
    }
  }, [branding, form]);

  const onSubmit = async (values: BrandingFormValues) => {
    setSubmitting(true);
    setSuccessMessage(null);
    setErrorMessage(null);

    try {
      // Convert empty strings to null
      const payload = Object.fromEntries(
        Object.entries(values).map(([key, value]) => [
          key,
          value === '' ? null : value,
        ])
      );

      await apiFetch('/branding', {
        method: 'PUT',
        body: JSON.stringify(payload),
      });

      setSuccessMessage('Branding settings saved successfully!');
      await refresh();

      // Clear success message after 3 seconds
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (error) {
      console.error('Failed to update branding:', error);
      const message = error instanceof ApiError ? error.message : 'Failed to update branding';
      setErrorMessage(message);
    } finally {
      setSubmitting(false);
    }
  };

  const isAdmin = user?.role === 'admin';

  if (!isAdmin) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="space-y-6"
      >
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Settings</h1>
          <p className="mt-2 text-muted-foreground">
            Customize your application branding and appearance.
          </p>
        </div>
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground">
              Only administrators can access settings.
            </p>
          </CardContent>
        </Card>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="space-y-6"
    >
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-2 text-muted-foreground">
          Customize your application branding and appearance.
        </p>
      </div>

      {successMessage && (
        <div className="flex items-center gap-2 rounded-md border border-green-500 bg-green-50 p-4 text-green-800 dark:bg-green-950 dark:text-green-200">
          <CheckCircle2 className="h-5 w-5" />
          <p>{successMessage}</p>
        </div>
      )}

      {errorMessage && (
        <div className="flex items-center gap-2 rounded-md border border-red-500 bg-red-50 p-4 text-red-800 dark:bg-red-950 dark:text-red-200">
          <AlertCircle className="h-5 w-5" />
          <p>{errorMessage}</p>
        </div>
      )}

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Application Identity</CardTitle>
              <CardDescription>
                Configure the name and branding that appears throughout the application.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="appName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>App Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Digital Storming" {...field} />
                    </FormControl>
                    <FormDescription>
                      The name displayed in the browser tab and page titles.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="panelName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Panel Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Digital Storming" {...field} />
                    </FormControl>
                    <FormDescription>
                      The name displayed in the sidebar header.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="logoUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Logo URL</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="/ds-logo-square.png or https://example.com/logo.png"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      URL to your logo image. Leave empty to use default.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="faviconUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Favicon URL</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="/favicon.ico or https://example.com/favicon.ico"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      URL to your favicon. Leave empty to use default.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="webrtcPhoneTitle"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>WebRTC Phone Title</FormLabel>
                    <FormControl>
                      <Input placeholder="Phone" {...field} />
                    </FormControl>
                    <FormDescription>
                      The title displayed on the WebRTC phone panel.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Login Page</CardTitle>
              <CardDescription>
                Customize the login page appearance.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="loginTitle"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Login Title</FormLabel>
                    <FormControl>
                      <Input placeholder="Leave empty to use App Name" {...field} />
                    </FormControl>
                    <FormDescription>
                      The title displayed on the login page.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="loginDescription"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Login Description</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Sign in to manage agents and providers."
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      The description displayed below the login title.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Social Links</CardTitle>
              <CardDescription>
                Configure external links displayed in the header.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="discordUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Discord URL</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="https://discord.gg/DFTU69Hg74"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="githubUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>GitHub URL</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="https://github.com/orgs/agentvoiceresponse/repositories"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="wikiUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Wiki/Documentation URL</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="https://wiki.agentvoiceresponse.com/"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Color Scheme</CardTitle>
              <CardDescription>
                Customize the color palette. Use OKLCH format (e.g., "oklch(0.5 0.2 180)") or leave empty for defaults.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="primaryColor"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Primary Color</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="oklch(0.205 0 0)"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      Main brand color used for buttons and accents.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="secondaryColor"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Secondary Color</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="oklch(0.97 0 0)"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      Secondary color for backgrounds and borders.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="accentColor"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Accent Color</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="oklch(0.97 0 0)"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      Accent color for highlights and hover states.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="destructiveColor"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Destructive Color</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="oklch(0.577 0.245 27.325)"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      Color used for destructive actions and error states.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button type="submit" disabled={submitting}>
              <Save className="mr-2 h-4 w-4" />
              {submitting ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </Form>
    </motion.div>
  );
}
