"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { Container } from "@/components/layout/container";
import {
  Accent,
  Eyebrow,
  SectionLead,
  SectionTitle,
} from "@/components/layout/section-heading";
import { getLeadershipMembers } from "@/lib/leadership-actions";
import { cn } from "@/lib/utils";

const EASE = [0.16, 1, 0.3, 1] as const;

interface Member {
  id: string;
  name: string;
  role: string;
  image?: string | null;
}

interface LeadershipRowProps {
  /** How many members to show. 0 shows everyone — the home page previews 8. */
  limit?: number;
  /** Keep the section (with a placeholder) instead of hiding it when nobody is listed. */
  showEmptyState?: boolean;
  /** Drop the top border when the section above already ends in one, so the
   *  two don't stack into a 2px seam. */
  seamless?: boolean;
  className?: string;
}

export function LeadershipRow({
  limit = 8,
  showEmptyState = false,
  seamless = false,
  className,
}: LeadershipRowProps) {
  const [members, setMembers] = useState<Member[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    getLeadershipMembers()
      .then((data) => setMembers(data))
      .catch((error) => console.error("Failed to load committee:", error))
      .finally(() => setIsLoading(false));
  }, []);

  // Don't flash an empty state while the fetch is still in flight.
  if (isLoading) return null;

  // Nothing to show until the committee is filled in from the admin panel. The
  // home page drops the section entirely; pages where the committee is a
  // headline section pass showEmptyState so the heading still lands.
  if (members.length === 0 && !showEmptyState) return null;

  const shown = limit > 0 ? members.slice(0, limit) : members;

  return (
    <section
      className={cn(
        "relative overflow-hidden border-b border-border bg-surface-3 py-24 md:py-32",
        !seamless && "border-t",
        className
      )}
    >
      <Container>
        <motion.div
          className="mx-auto mb-14 max-w-2xl text-center"
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.7, ease: EASE }}
        >
          <div className="flex justify-center">
            <Eyebrow>Committee</Eyebrow>
          </div>
          <SectionTitle className="mt-6">
            Our <Accent>Committee</Accent>
          </SectionTitle>
          <SectionLead className="mx-auto mt-5 max-w-lg">
            The volunteers who run KSA this year — with day jobs, families, and
            a shared stubbornness about keeping this going.
          </SectionLead>
        </motion.div>

        {shown.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-border py-20 text-center">
            <p className="font-sans text-lg font-bold tracking-[-0.015em] text-foreground">
              Committee Not Listed Yet
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              This year&apos;s committee will be published here shortly.
            </p>
          </div>
        ) : (
          <motion.div
            className="grid grid-cols-2 gap-5 sm:grid-cols-3 md:gap-6 lg:grid-cols-4"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-60px" }}
            variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.06 } } }}
          >
            {shown.map((member) => (
              <motion.div
                key={member.id}
                variants={{
                  hidden: { opacity: 0, y: 20 },
                  visible: {
                    opacity: 1,
                    y: 0,
                    transition: { duration: 0.6, ease: EASE },
                  },
                }}
                className="group"
              >
                <div className="relative aspect-4/5 overflow-hidden rounded-2xl border border-border bg-muted">
                  {member.image ? (
                    <img
                      src={member.image}
                      alt={member.name}
                      loading="lazy"
                      className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.03]"
                    />
                  ) : (
                    <span className="absolute inset-0 flex items-center justify-center font-sans text-3xl font-extrabold tracking-[-0.04em] text-muted-foreground/40">
                      {member.name
                        .split(" ")
                        .map((part) => part[0])
                        .slice(0, 2)
                        .join("")}
                    </span>
                  )}
                </div>

                <h3 className="mt-4 font-sans text-[15px] font-bold tracking-[-0.015em] text-foreground">
                  {member.name}
                </h3>
                <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  {member.role}
                </p>
              </motion.div>
            ))}
          </motion.div>
        )}

        <div className="mt-14 flex justify-center">
          <Link
            href="/contact"
            className="group inline-flex items-center gap-2 text-sm font-semibold text-foreground"
          >
            <span className="border-b border-foreground/30 pb-0.5 transition-colors group-hover:border-primary group-hover:text-primary">
              Contact the committee
            </span>
            <ArrowUpRight className="h-4 w-4 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-primary" />
          </Link>
        </div>
      </Container>
    </section>
  );
}
