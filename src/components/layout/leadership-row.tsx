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

const EASE = [0.16, 1, 0.3, 1] as const;

interface Member {
  id: string;
  name: string;
  role: string;
  image?: string | null;
}

export function LeadershipRow() {
  const [members, setMembers] = useState<Member[]>([]);

  useEffect(() => {
    getLeadershipMembers()
      .then((data) => setMembers(data))
      .catch((error) => console.error("Failed to load committee:", error));
  }, []);

  // Nothing to show until the committee is filled in from the admin panel.
  if (members.length === 0) return null;

  const shown = members.slice(0, 8);

  return (
    <section className="relative overflow-hidden border-y border-border bg-surface-3 py-24 md:py-32">
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
                    className="absolute inset-0 h-full w-full object-cover grayscale transition-all duration-700 group-hover:scale-[1.03] group-hover:grayscale-0"
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
