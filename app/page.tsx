import { ProfileHeader } from "@/components/profile-header";
import { ContributionsSection } from "@/components/contributions-section";
import { WorkHistory } from "@/components/work-history";
import { Projects } from "@/components/projects";
import { siteConfig } from "@/content/site";

function Separator() {
  return (
    <div className="diagonal-stripes h-8 w-full border-x border-line" />
  );
}

export default function Home() {
  return (
    <main className="min-h-screen">
      <div className="mx-auto md:max-w-3xl">
        <ProfileHeader />
        <Separator />

        <ContributionsSection />
        <Separator />

        <WorkHistory />
        <Separator />

        <Projects />
        <Separator />

        <footer className="border-x border-line px-4 py-8">
          <p className="text-sm text-muted-foreground">
            &copy; {new Date().getFullYear()} {siteConfig.name}. All rights
            reserved.
          </p>
        </footer>
      </div>
    </main>
  );
}
