"use client";

import { resolveSections } from "@/lib/home-layout";
import type { HomeContentT } from "@/lib/home-schema";
import { HOME_SECTION_COMPONENTS } from "@/components/layout/home-sections";
import type { EventCard } from "@/components/layout/events-band-section";

export function HomePageClient({
  content,
  events,
}: {
  content: HomeContentT;
  events: EventCard[];
}) {
  const sections = resolveSections(content.layout);

  return (
    <main className="min-h-screen flex flex-col bg-background">
      {sections.map(({ id, surface, tone, bordered }) => {
        const Section = HOME_SECTION_COMPONENTS[id];

        return (
          <Section
            key={id}
            content={content.content[id]}
            surface={surface}
            tone={tone}
            bordered={bordered}
            {...(id === "events" ? { events } : {})}
          />
        );
      })}
    </main>
  );
}
