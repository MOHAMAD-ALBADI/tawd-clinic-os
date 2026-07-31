import { Hero, TriCards } from "@/components/site/hero";
import { SuraDemo } from "@/components/site/sura-demo";
import { StatsBar } from "@/components/site/stats";
import { Problem, Sectors, Security, Closing, Flow, Modules } from "@/components/site/home-blocks";
import { FeatureRows, FaqPreview } from "@/components/site/sections";
import { RoiCalculator } from "@/components/site/roi";

/* Home — fifteen sections.

   Ordered the way a clinic owner decides rather than the way we would like to
   talk: what this is → what it runs on → why it matters → what it is costing
   you → see it work yourself → how → the product, three times → proof → what
   you would save → the whole system → is it for me → can I trust it → the
   questions everyone asks → the ask.

   The demo sits early on purpose. It is the only section a visitor can drive,
   and putting it after four screenshots wastes the one thing that convinces. */
export default function HomePage() {
  return (
    <>
      <Hero />          {/* 1 · 2 — hero + infrastructure strip */}
      <TriCards />      {/* 3 — the three isometric propositions */}
      <Problem />       {/* 4 — the cost of silence */}
      <SuraDemo />      {/* 5 — drive it yourself */}
      <Flow />          {/* 6 — how it works */}
      <FeatureRows />   {/* 7 · 8 · 9 — schedule, money, stock */}
      <StatsBar />      {/* 10 — proof */}
      <RoiCalculator /> {/* 11 — what it is worth to you */}
      <Modules />       {/* 12 — the whole system */}
      <Sectors />       {/* 13 — who it is for */}
      <Security />      {/* 14 — why you can trust it */}
      <FaqPreview />    {/* 15 — the questions */}
      <Closing />       {/* the ask */}
    </>
  );
}
