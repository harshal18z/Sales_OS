import React, { lazy, Suspense, useMemo } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@/lib/query";
import { AuthProvider } from "@/hooks/use-auth";
import { Toaster } from "sonner";
import { OfflineBanner } from "@/components/app/offline-banner";
import { AppErrorBoundary } from "@/components/app/error-boundary";
import { SpeedInsights } from "@vercel/speed-insights/react";

type RouteModule = { Route: { component: React.ComponentType } };
function routeComponent(load: () => Promise<RouteModule>) {
  return lazy(async () => ({ default: (await load()).Route.component }));
}

const IndexPage = routeComponent(() => import("@/routes/index"));
const LoginPage = routeComponent(() => import("@/routes/login"));
const SignupPage = routeComponent(() => import("@/routes/signup"));
const ForgotPasswordPage = routeComponent(() => import("@/routes/forgot-password"));
const ResetPasswordPage = routeComponent(() => import("@/routes/reset-password"));
const MagicLinkPage = routeComponent(() => import("@/routes/magic-link"));
const OnboardingPage = routeComponent(() => import("@/routes/onboarding"));
const WorkspacePage = routeComponent(() => import("@/routes/workspace"));
const WorkspaceNewPage = routeComponent(() => import("@/routes/workspace-new"));
const WorkspaceInvitePage = routeComponent(() => import("@/routes/workspace-invite"));
const PrivacyPage = routeComponent(() => import("@/routes/privacy"));
const TermsPage = routeComponent(() => import("@/routes/terms"));
const SecurityPage = routeComponent(() => import("@/routes/security"));
const ConsentPage = routeComponent(() => import("@/routes/[.]lovable.oauth.consent"));

const ShellLayout = lazy(() => import("@/routes/_shell"));
const DashboardPage = routeComponent(() => import("@/routes/_shell.dashboard"));
const LeadsPage = routeComponent(() => import("@/routes/_shell.leads"));
const LeadDetailPage = routeComponent(() => import("@/routes/_shell.lead.$id"));
const CompaniesPage = routeComponent(() => import("@/routes/_shell.companies"));
const CompanyDetailPage = routeComponent(() => import("@/routes/_shell.company.$id"));
const CampaignsPage = routeComponent(() => import("@/routes/_shell.campaigns"));
const CampaignDetailPage = routeComponent(() => import("@/routes/_shell.campaigns.$id"));
const EmailsPage = routeComponent(() => import("@/routes/_shell.emails"));
const MeetingsPage = routeComponent(() => import("@/routes/_shell.meetings"));
const CRMPage = routeComponent(() => import("@/routes/_shell.crm"));
const ResearchPage = routeComponent(() => import("@/routes/_shell.research"));
const CopilotPage = routeComponent(() => import("@/routes/_shell.copilot"));
const AnalyticsPage = routeComponent(() => import("@/routes/_shell.analytics"));
const CalendarPage = routeComponent(() => import("@/routes/_shell.calendar"));
const IntegrationsPage = routeComponent(() => import("@/routes/_shell.integrations"));
const SettingsPage = routeComponent(() => import("@/routes/_shell.settings"));
const TemplatesPage = routeComponent(() => import("@/routes/_shell.templates"));
const FollowupsPage = routeComponent(() => import("@/routes/_shell.followups"));
const BillingPage = routeComponent(() => import("@/routes/_shell.billing"));
const TeamPage = routeComponent(() => import("@/routes/_shell.team"));
const ProfilePage = routeComponent(() => import("@/routes/_shell.profile"));

function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

function LoadingPage() {
  return (
    <div className="grid min-h-[45vh] place-items-center text-sm text-foreground-muted">
      Loading…
    </div>
  );
}

export function App() {
  const queryClient = useMemo(() => new QueryClient(), []);
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <OfflineBanner />
          <AppErrorBoundary>
            <Suspense fallback={<LoadingPage />}>
              <Routes>
                <Route path="/" element={<IndexPage />} />
                <Route path="/login" element={<LoginPage />} />
                <Route path="/signup" element={<SignupPage />} />
                <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                <Route path="/reset-password" element={<ResetPasswordPage />} />
                <Route path="/magic-link" element={<MagicLinkPage />} />
                <Route path="/onboarding" element={<OnboardingPage />} />
                <Route path="/workspace" element={<WorkspacePage />} />
                <Route path="/workspace-new" element={<WorkspaceNewPage />} />
                <Route path="/workspace-invite" element={<WorkspaceInvitePage />} />
                <Route path="/privacy" element={<PrivacyPage />} />
                <Route path="/terms" element={<TermsPage />} />
                <Route path="/security" element={<SecurityPage />} />
                <Route path="/lovable/oauth/consent" element={<ConsentPage />} />
                <Route path="/.lovable/oauth/consent" element={<ConsentPage />} />
                <Route element={<ShellLayout />}>
                  <Route path="/dashboard" element={<DashboardPage />} />
                  <Route path="/leads" element={<LeadsPage />} />
                  <Route path="/lead/:id" element={<LeadDetailPage />} />
                  <Route path="/companies" element={<CompaniesPage />} />
                  <Route path="/company/:id" element={<CompanyDetailPage />} />
                  <Route path="/campaigns" element={<CampaignsPage />} />
                  <Route path="/campaigns/:id" element={<CampaignDetailPage />} />
                  <Route path="/emails" element={<EmailsPage />} />
                  <Route path="/meetings" element={<MeetingsPage />} />
                  <Route path="/crm" element={<CRMPage />} />
                  <Route path="/research" element={<ResearchPage />} />
                  <Route path="/copilot" element={<CopilotPage />} />
                  <Route path="/analytics" element={<AnalyticsPage />} />
                  <Route path="/calendar" element={<CalendarPage />} />
                  <Route path="/integrations" element={<IntegrationsPage />} />
                  <Route path="/settings" element={<SettingsPage />} />
                  <Route path="/templates" element={<TemplatesPage />} />
                  <Route path="/followups" element={<FollowupsPage />} />
                  <Route path="/billing" element={<BillingPage />} />
                  <Route path="/team" element={<TeamPage />} />
                  <Route path="/profile" element={<ProfilePage />} />
                </Route>
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </AppErrorBoundary>
          <Toaster position="top-right" richColors />
          <SpeedInsights />
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
