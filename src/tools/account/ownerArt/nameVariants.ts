/**
 * Owner name style variants (T64): B–E for each set's name style (13–20); A is the style itself
 * (OwnerArt.tsx). Each is fixed HTML from the variant sheets with two marks: @@W@@ = the name,
 * @@L@@ = the name one letter per span. The name is always escaped before it goes in
 * (OwnerArt.tsx), so nothing a person types can become markup.
 */
export interface OwnerNameVariant {
  name: string;
  line: string;
  tpl: string;
}

/** Name style number → its variants B–E (index 0 here is B). */
export const OWNER_NAME_VARIANTS: Readonly<Record<number, readonly OwnerNameVariant[]>> = {
  13: [
    { name: "Molten Pour", line: "Molten gold fills the letters from the bottom up, then cools.",
      tpl: "<span class=\"oa-v-pour\" data-t=\"@@W@@\">@@W@@</span>" },
    { name: "Ring Drip", line: "Gold letters with small rings dripping off them and falling.",
      tpl: "<span class=\"oa-v-drip\">@@W@@<i style=\"left:12%;animation-delay:0s\"></i><i style=\"left:38%;animation-delay:0.8s\"></i><i style=\"left:63%;animation-delay:1.6s\"></i><i style=\"left:86%;animation-delay:0.4s\"></i></span>" },
    { name: "Forge Heat", line: "Letters heat from cherry red to white-hot, with a heat shimmer.",
      tpl: "<span class=\"oa-v-heat\">@@W@@</span>" },
    { name: "Coin Toss", line: "Each letter flips like a gold coin, one after another.",
      tpl: "<span class=\"oa-v-coin\">@@L@@</span>" },
  ],
  14: [
    { name: "Howl Echo", line: "Silver letters with fading echoes rippling out from them, like a howl.",
      tpl: "<span class=\"oa-v-echo\" data-t=\"@@W@@\">@@W@@</span>" },
    { name: "Claw Marks", line: "Three claw slashes rake across, then the silver name shows.",
      tpl: "<span class=\"oa-v-claw\">@@W@@<svg viewBox=\"0 0 100 40\" preserveAspectRatio=\"none\"><path d=\"M10 34 L40 4 M30 38 L62 6 M52 38 L84 8\" stroke=\"#dfe6f2\" stroke-width=\"2\" stroke-linecap=\"round\" fill=\"none\"/></svg></span>" },
    { name: "Moonlit Fur", line: "Letters filled with fine silver fur that moves in the wind.",
      tpl: "<span class=\"oa-v-fur\">@@W@@</span>" },
    { name: "Paw Steps", line: "Tiny paw prints step along under the name.",
      tpl: "<span class=\"oa-v-paws\">@@W@@<span class=\"oa-pw\"><i style=\"--i:0\"></i><i style=\"--i:1\"></i><i style=\"--i:2\"></i><i style=\"--i:3\"></i><i style=\"--i:4\"></i><i style=\"--i:5\"></i><i style=\"--i:6\"></i></span></span>" },
  ],
  15: [
    { name: "Spear Throw", line: "A spear flies through the name; each letter lights up as it passes.",
      tpl: "<span class=\"oa-v-spear\">@@L@@<b class=\"oa-sp\"></b></span>" },
    { name: "Storm Charge", line: "Electric letters that crackle and jump with small sparks.",
      tpl: "<span class=\"oa-v-charge\">@@L@@</span>" },
    { name: "Rain Streak", line: "Steel letters with rain streaking down over them, wet sheen.",
      tpl: "<span class=\"oa-v-rain\">@@W@@</span>" },
    { name: "Shockwave", line: "Letters bounce outward in a wave from the middle, a ring of force behind.",
      tpl: "<span class=\"oa-v-shock\">@@L@@</span>" },
  ],
  16: [
    { name: "Eclipse Pass", line: "A dark moon slides across the name, leaving a gold corona edge behind.",
      tpl: "<span class=\"oa-v-eclipse\">@@W@@<b class=\"oa-moon\"></b></span>" },
    { name: "Moon Phases", line: "Each letter goes from new moon to full and back, in a wave.",
      tpl: "<span class=\"oa-v-phase\">@@L@@</span>" },
    { name: "Sundial Shadow", line: "Moonlit letters cast a long shadow that turns like a sundial.",
      tpl: "<span class=\"oa-v-dial\">@@W@@</span>" },
    { name: "Sun & Moon Orbit", line: "A tiny sun and moon circle the name on a tilted orbit.",
      tpl: "<span class=\"oa-v-orbit\">@@W@@<b class=\"oa-sun\"></b><b class=\"oa-mn\"></b></span>" },
  ],
  17: [
    { name: "Aurora Wave", line: "Letters ripple in a wave, colour moving from green to violet along them.",
      tpl: "<span class=\"oa-v-wave\">@@L@@</span>" },
    { name: "Rune Stamp", line: "Each letter is stamped down one after another, with a puff of dust.",
      tpl: "<span class=\"oa-v-stamp\">@@L@@</span>" },
    { name: "Green Flame", line: "Small green flames flicker up off the letters.",
      tpl: "<span class=\"oa-v-gflame\" data-t=\"@@W@@\">@@W@@</span>" },
    { name: "Mirror Realm", line: "The name with a rippling reflection beneath it, like still water.",
      tpl: "<span class=\"oa-v-mirror\" data-t=\"@@W@@\">@@W@@</span>" },
  ],
  18: [
    { name: "Knot Band", line: "A knotwork band draws itself under the name.",
      tpl: "<span class=\"oa-v-knot\">@@W@@<svg viewBox=\"0 0 200 20\" preserveAspectRatio=\"none\"><path d=\"M0 10 C20 0 30 20 50 10 S80 0 100 10 S130 20 150 10 S180 0 200 10 M0 10 C20 20 30 0 50 10 S80 20 100 10 S130 0 150 10 S180 20 200 10\" fill=\"none\" stroke=\"#c8532e\" stroke-width=\"2.4\" vector-effect=\"non-scaling-stroke\"/></svg></span>" },
    { name: "Chisel", line: "Letters are chiselled out of stone: dust, an outline, then red-ochre fill.",
      tpl: "<span class=\"oa-v-chisel\">@@W@@</span>" },
    { name: "Serpent Slither", line: "A serpent slithers through the letters from end to end.",
      tpl: "<span class=\"oa-v-slither\">@@W@@<svg viewBox=\"0 0 200 40\" preserveAspectRatio=\"none\"><path d=\"M-20 20 Q0 4 20 20 T60 20 T100 20 T140 20 T180 20 T220 20\" fill=\"none\" stroke=\"#c8532e\" stroke-width=\"3\" stroke-linecap=\"round\" vector-effect=\"non-scaling-stroke\"/></svg></span>" },
    { name: "Runic Weave", line: "Letters weave up and down, red and grey in turn, like a woven band.",
      tpl: "<span class=\"oa-v-weave\">@@L@@</span>" },
  ],
  19: [
    { name: "Torchlight", line: "Gold letters lit by a torch that moves along them, shadows following.",
      tpl: "<span class=\"oa-v-torch\">@@W@@</span>" },
    { name: "War Chant", line: "Letters pulse to a war chant's beat, four at a time.",
      tpl: "<span class=\"oa-v-chant\">@@L@@</span>" },
    { name: "Gold Leaf", line: "Gold leaf flakes settle onto the letters and shine.",
      tpl: "<span class=\"oa-v-leaf\">@@W@@<i style=\"left:10%;animation-delay:0s\"></i><i style=\"left:30%;animation-delay:0.7s\"></i><i style=\"left:52%;animation-delay:1.4s\"></i><i style=\"left:74%;animation-delay:0.35s\"></i><i style=\"left:90%;animation-delay:1.05s\"></i></span>" },
    { name: "Shield Row", line: "Each letter sits on its own small round shield, crimson and gold.",
      tpl: "<span class=\"oa-v-shields\">@@L@@</span>" },
  ],
  20: [
    { name: "Echo Waveform", line: "A sound waveform pulses under the name.",
      tpl: "<span class=\"oa-v-waveform\">@@W@@<span class=\"oa-wf\"><i style=\"--i:0\"></i><i style=\"--i:1\"></i><i style=\"--i:2\"></i><i style=\"--i:3\"></i><i style=\"--i:4\"></i><i style=\"--i:5\"></i><i style=\"--i:6\"></i><i style=\"--i:7\"></i><i style=\"--i:8\"></i><i style=\"--i:9\"></i><i style=\"--i:10\"></i><i style=\"--i:11\"></i><i style=\"--i:12\"></i><i style=\"--i:13\"></i><i style=\"--i:14\"></i><i style=\"--i:15\"></i></span></span>" },
    { name: "Wind Gust", line: "A gust sweeps through: letters lean and drift, then settle.",
      tpl: "<span class=\"oa-v-gust\">@@L@@</span>" },
    { name: "Horn Blast", line: "The name bursts out from small, with a cone of sound lines behind.",
      tpl: "<span class=\"oa-v-blast\">@@W@@</span>" },
    { name: "Snowfall", line: "Snow falls gently over ice-white letters.",
      tpl: "<span class=\"oa-v-snow\">@@W@@<i style=\"left:8%;animation-delay:0s\"></i><i style=\"left:22%;animation-delay:1.1s\"></i><i style=\"left:36%;animation-delay:0.5s\"></i><i style=\"left:50%;animation-delay:1.7s\"></i><i style=\"left:64%;animation-delay:0.2s\"></i><i style=\"left:78%;animation-delay:1.3s\"></i><i style=\"left:92%;animation-delay:0.8s\"></i></span>" },
  ],
};
