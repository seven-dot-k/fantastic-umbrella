import type {
  GameInterfaceClue,
  GameInterfacePersona,
} from "@/components/game/game-interface";

/**
 * Mock scenario data used by the backend workflow AND by the PIXIJS game
 * engine (for pre-bridge validation).
 *
 * - `fallbackGameScenario` preserves the exact shape the backend workflow
 *   consumes (scenario + personas + secretState with `personaSecrets` array).
 * - `mockPersonas` / `mockClues` expose just the subset the GameInterface
 *   component currently needs, derived from the fallback data.
 */
export const fallbackGameScenario = {
  scenario: {
    title: "The Midnight Masquerade at Thornfield Manor",
    setting:
      "Thornfield Manor, a ridiculously fancy Victorian estate hosting a masquerade ball. Think chandeliers everywhere, a library no one actually reads in, a conservatory full of plants that definitely judge you, and way too many creepy hallway portraits.",
    victimName:
      "Lord Adrian Ashworth, 58-year-old family patriarch and professional buzzkill",
    timeOfDeath: "Between 10:30 PM and 11:15 PM — found face-down next to his brandy at midnight",
    synopsis:
      "Lord Adrian Ashworth is dead in the library (classic move). There's a poisoned brandy glass next to him and his masquerade mask is still on, which is honestly kind of iconic. Everyone at this party had beef with him — his trophy wife, his dramatic son, his fed-up business partner, a shady art dealer, and his own sister. Adrian had just announced he was rewriting his will and cutting funding to basically everyone. Awkward! Now someone's a murderer and everyone else is acting super suspicious about their own stuff.",
    clues: [
      "A fancy handkerchief clutched in the victim's hand with the initials 'EW' embroidered on it — not exactly subtle",
      "A half-burned letter in the fireplace that literally says 'tonight must be the night' — whoever burned this did a terrible job",
      "Rare orchid pollen all over the victim's jacket, and only two people even go near the conservatory — that narrows it down real quick",
    ],
  },
  personas: [
    {
      id: "suspect_001",
      name: "Victoria Ashworth",
      age: 34,
      occupation: "Professional Trophy Wife and Influencer",
      relationship: "Second wife of Lord Adrian Ashworth",
      description:
        "Victoria married rich and isn't shy about it. She talks like she's permanently on a reality TV confessional and her peacock mask is the most extra thing at this party. Adrian just froze her credit cards and she is NOT happy about it.",
      mood: "fake smiling",
      sanity: 72,
    },
    {
      id: "suspect_002",
      name: "Sebastian Ashworth",
      age: 31,
      occupation: "Aspiring Artist (Self-Proclaimed Genius)",
      relationship: "Estranged son of Lord Adrian Ashworth",
      description:
        "Sebastian showed up drunk, wearing a wolf mask, and immediately started arguing with his dad about money. He calls himself an artist but has never sold a painting. Gets very loud when he's nervous, which is basically always.",
      mood: "agitated and dramatic",
      sanity: 58,
    },
    {
      id: "suspect_003",
      name: "Margaret Chen",
      age: 62,
      occupation: "Business Partner and Number Cruncher",
      relationship: "Long-time business partner of Lord Adrian",
      description:
        "Margaret is the scariest person at this party and she knows it. Speaks in short, clipped sentences like every word costs money. Wore a raven mask and was overheard telling Adrian his decisions would 'destroy everything' — in her calm, terrifying way.",
      mood: "coolly irritated",
      sanity: 79,
    },
    {
      id: "suspect_004",
      name: "Julian Moreau",
      age: 45,
      occupation: "\"International Art Dealer\" (Air Quotes)",
      relationship: "Business acquaintance of the Ashworth family",
      description:
        "Julian has a fake-sounding French accent that gets thicker when he's lying, which is constantly. He's been trying to sell Adrian some very expensive paintings and is way too charming about it. His golden mask has actual jewels on it, which tells you everything.",
      mood: "suspiciously charming",
      sanity: 68,
    },
    {
      id: "suspect_005",
      name: "Eleanor Whitmore",
      age: 56,
      occupation: "Head of the Ashworth Foundation",
      relationship: "Sister of Lord Adrian Ashworth",
      description:
        "Eleanor is Adrian's big sister and runs the family charity like a military operation. She talks like she's always giving a TED Talk and was spotted having an intense whispered argument with Adrian near the library at 10:15 PM. Her swan mask is very dignified, just like her passive-aggressive comments.",
      mood: "stressed but dignified",
      sanity: 75,
    },
  ],
  secretState: {
    murdererId: "suspect_005",
    motive:
      "Eleanor found out Adrian was going to pull all funding from the Ashworth Foundation — her entire life's work for 30 YEARS — and blow it on a personal art collection. He was also slashing her inheritance. She basically snapped.",
    weapon:
      "Cyanide dissolved in a bottle of Adrian's favorite fancy brandy (1947 Château d'Yquem). Eleanor poisoned it before the party even started. Sneaky!",
    opportunity:
      "Eleanor got there early to 'oversee decorations' (actually to set up the poisoned brandy). She knew Adrian always snuck off to the library for a drink around 10:30. During the party, she slipped away, handed him the brandy like 'hey bro, found this special bottle for you,' and he drank it because he trusted her. She was back at the party in minutes. The masks made it easy to disappear.",
    personaSecrets: [
      {
        personaId: "suspect_001",
        alibi:
          "Victoria says she was in the conservatory chatting with Julian about art for 45 minutes. Julian says it was more like 5 minutes. A waiter saw her in the conservatory arranging flowers at 10:45 PM and she was back at the party by 10:55. Her alibi checks out, she's just bad at estimating time.",
        secrets:
          "Victoria married Adrian for the money (obviously) and has been secretly dating the groundskeeper. She also has massive gambling debts and was counting on Adrian's inheritance money to pay them off. So yeah, she's nervous but not murderer-nervous.",
        personality:
          "Victoria talks like she's always being filmed. Very dramatic, lots of hair flipping. Gets snippy when caught in a lie and deflects by talking about how hard her life is. Laughs at her own jokes even when they're mean.",
        cluePool: [
          "I saw Eleanor heading toward the library around 10:30 with a bottle of something — I assumed it was wine but now I'm not so sure.",
          "Adrian told me at dinner he was rewriting his will. He said 'some people are going to be very unhappy tomorrow' and looked right at Eleanor.",
          "The brandy Adrian was drinking — that's not from the bar. That's from his private collection. Someone would have to know where he keeps it.",
          "I was in the conservatory and I heard Eleanor and Adrian arguing near the library around 10:15. She said something like 'you can't just erase thirty years.'",
          "Eleanor was at the manor hours before the party started. She said it was for decorations but I saw her going into the wine cellar alone.",
          "There's orchid pollen on Adrian's jacket. Only Eleanor and I ever go in the conservatory, and I wasn't near Adrian all night.",
        ],
      },
      {
        personaId: "suspect_002",
        alibi:
          "Sebastian says he was in his bedroom reading. Alone. With no witnesses. (Suspicious, right?) But a maid heard music playing in his room all evening and saw him come out around 11:05 PM looking flustered. It's a lame alibi but it's actually true.",
        secrets:
          "Sebastian is completely broke from bad art investments and blowing through his trust fund. Dad threatened to cut him off for good, which would be catastrophic. He also has a massive inferiority complex about never living up to Adrian's expectations. Basically a walking motive, but he didn't do it.",
        personality:
          "Sebastian talks in rapid, panicky bursts and interrupts everyone including himself. Super defensive about being called a failed artist. Fidgets constantly — adjusting his mask, tugging his cuffs, checking his phone. Acts like he's above everything while clearly falling apart.",
        cluePool: [
          "I heard Eleanor on the phone two days ago saying 'the lawyer confirmed it — he's cutting everything.' She sounded furious.",
          "When I came out of my room around 11:05, I saw Eleanor speed-walking from the direction of the library. She looked rattled.",
          "Dad always drank brandy in the library at 10:30 — literally everyone in the family knows that. It's been his routine for twenty years.",
          "Eleanor asked me last week if I knew anything about poisons. She said it was for her garden. I thought it was weird but didn't think much of it.",
          "That handkerchief they found in dad's hand has 'EW' on it. Those are Aunt Eleanor's initials — Eleanor Whitmore.",
          "I overheard Margaret telling Eleanor that Adrian was planning to defund the Foundation. Eleanor went completely white.",
        ],
      },
      {
        personaId: "suspect_003",
        alibi:
          "Margaret says she was in the room next to the library reviewing business documents from 10:00 to 11:10 PM. Says she heard nothing. Which IS suspicious since she was literally in the adjacent room — but the walls are super thick and soundproofed, and her footprints confirm she was at the desk. She's telling the truth, she's just unfortunately positioned.",
        secrets:
          "Margaret found out Adrian was planning to dump their 30-year business partnership without telling her. Also, she's been skimming about £80,000 from the company over five years to pay for her sister's medical bills. If anyone finds the books, she's toast. That's why she's so uptight.",
        personality:
          "Margaret talks like she bills by the hour. Very precise, no wasted words. Terrifyingly calm exterior but if you watch closely she twitches when you bring up money. Gets weirdly specific about details nobody asked for, which makes her seem more suspicious than she actually is.",
        cluePool: [
          "I reviewed Adrian's financial records last week. He was liquidating Foundation assets to buy an art collection. Eleanor's entire department was being dissolved.",
          "Eleanor visited Adrian's lawyer two days before the party. I know because the lawyer's office called me to confirm a detail about the estate.",
          "The poisoned brandy was a 1947 Château d'Yquem. Adrian kept it locked in his study. Only family members know the combination — that rules out Julian.",
          "I was in the room next to the library. I heard the library door open and close at approximately 10:35. No voices — just the door and footsteps.",
          "Eleanor arrived at the manor at 3 PM, five hours before the party. She told staff she was overseeing decorations but the decorator said she never spoke to Eleanor.",
          "That half-burned letter in the fireplace — I recognize the stationery. It's from Eleanor's personal desk. She uses that cream-colored paper with the Foundation watermark.",
        ],
      },
      {
        personaId: "suspect_004",
        alibi:
          "Julian says he was down in the wine cellar 'admiring the collection' from 10:20 to 11:00 PM. The cellar attendant kinda-sorta remembers seeing someone who might have been him? Julian dramatically produces a business card with wine notes on it as 'proof.' His alibi is thin but ultimately holds up.",
        secrets:
          "Julian isn't actually an art dealer — he's an art FORGER. He's been trying to sell Adrian fake paintings passed off as authentic. He also has a fraud conviction in Monaco that nobody here knows about. If his scam gets exposed, he loses everything. That's why he's being extra charming and extra sweaty.",
        personality:
          "Julian cranks the French accent up to eleven when he's nervous. Compliments everyone constantly — 'what a beautiful question, detective!' Tries to steer every conversation toward how sophisticated and well-traveled he is. The charm is turned up so high it loops back around to being suspicious.",
        cluePool: [
          "I was in the wine cellar and I noticed the 1947 Château d'Yquem was missing from the rack. That bottle is worth a fortune — someone took it before the party.",
          "When I talked to Victoria in the conservatory, she mentioned Eleanor had been acting 'intense' all week — more than usual, and that's saying something.",
          "I saw Eleanor near the kitchen at around 10:25, but she told everyone she was there from 10:30. Her timeline is off by at least five minutes.",
          "Adrian showed me the burned letter pieces in the fireplace earlier that evening. He said 'my sister has been making threats' but didn't elaborate.",
          "Eleanor knows a lot about rare plants and their properties. She once told me at dinner which orchids are toxic. Very specific knowledge for a charity director.",
          "The masks made it easy to move around unnoticed. But Eleanor's swan mask is distinctive — a waiter told me he saw a swan mask near the library at 10:40.",
        ],
      },
      {
        personaId: "suspect_005",
        alibi:
          "Eleanor says she was in the kitchen supervising dinner prep from 10:30 to 11:00 PM. The chef says she was actually only there for about 10 minutes, then bolted saying she 'needed to check on a guest.' Kitchen staff can't confirm when she came back. Security cameras are useless because everyone's wearing masks. Her alibi has a big, obvious hole in it.",
        secrets:
          "Eleanor secretly met with Adrian's lawyer two days ago and found out about the foundation defunding AND the inheritance cuts. She'd also been Googling cyanide on her personal laptop three weeks earlier (yikes). Plus she discovered Adrian has a secret lovechild he planned to add to the will. She's got motive coming out of her ears.",
        personality:
          "Eleanor talks like she's giving a PowerPoint presentation at all times. Very 'duty this' and 'legacy that.' Makes passive-aggressive comments disguised as concern ('I'm just WORRIED about you, dear'). If you push her on timeline details, she gets flustered and tries to redirect to how much she's done for the family.",
        cluePool: [
          "I was supervising dinner prep in the kitchen... well, for part of the time. I may have stepped out briefly to check on a guest. It's all a blur honestly.",
          "Adrian and I had a disagreement about the Foundation's future, yes. But it was a professional disagreement. Sisters don't kill brothers over budget meetings.",
          "Sebastian was alone in his room all night with no witnesses. Doesn't that seem suspicious to you? He was furious about being cut off.",
          "Victoria has massive gambling debts — did you know that? She needed Adrian's money desperately. Much more desperately than I did.",
          "Margaret was in the room RIGHT NEXT to the library. She could have easily slipped in. And she has her own financial secrets, believe me.",
          "I arrived early to oversee decorations, that's all. The staff can confirm... well, the ones who were paying attention, anyway.",
        ],
      },
    ],
  },
};

/**
 * Personas reduced to the subset the GameInterface needs (id, name, mood).
 * Used for pre-bridge UI validation.
 */
export const mockPersonas: GameInterfacePersona[] =
  fallbackGameScenario.personas.map((p) => ({
    id: p.id,
    name: p.name,
    mood: p.mood,
  }));

/**
 * Clues formatted for the HUD. Titles are hand-written short summaries; the
 * full scenario-clue string is preserved as the description tooltip body.
 */
export const mockClues: GameInterfaceClue[] = [
  {
    id: "clue-1",
    title: "Monogrammed handkerchief",
    description: fallbackGameScenario.scenario.clues[0],
  },
  {
    id: "clue-2",
    title: "Half-burned letter",
    description: fallbackGameScenario.scenario.clues[1],
  },
  {
    id: "clue-3",
    title: "Orchid pollen trace",
    description: fallbackGameScenario.scenario.clues[2],
  },
];
