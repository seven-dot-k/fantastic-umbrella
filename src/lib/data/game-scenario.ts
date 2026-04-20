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
      "Thornfield Manor, a sprawling Victorian estate in the English countryside during a lavish masquerade ball. Grand halls adorned with chandeliers, a library with floor-to-ceiling shelves, a conservatory filled with exotic plants, and dimly lit corridors lined with portraits.",
    victimName:
      "Lord Adrian Ashworth, 58-year-old patriarch of the Ashworth family and wealthy financier",
    timeOfDeath: "Between 10:30 PM and 11:15 PM, discovered at midnight",
    synopsis:
      "Lord Adrian Ashworth lies dead in the locked library, a crystal glass of poisoned brandy beside him. His ornate masquerade mask remains on his face, obscuring his identity at first glance. The evening's guests—including his estranged son, his much younger second wife, his business partner, and a mysterious art dealer—were all present at the ball. Adrian had recently announced his intention to restructure his will and withdraw funding from his family's philanthropic foundation. Tensions were high, and whispered conversations were noted throughout the night.",
    clues: [
      "A monogrammed handkerchief found clutched in the victim's hand, embroidered with the initials 'ES' belonging to a character the detective must identify",
      "A half-burned letter discovered in the library fireplace containing fragments mentioning 'the insurance policy' and 'tonight must be the night'",
      "Traces of rare orchid pollen on the victim's dinner jacket, indicating he spent time in the conservatory shortly before his death, where only the head gardener and one guest have unrestricted access",
    ],
  },
  personas: [
    {
      id: "suspect_001",
      name: "Victoria Ashworth",
      age: 34,
      occupation: "Society Hostess and Philanthropist",
      relationship: "Second wife of Lord Adrian Ashworth",
      description:
        "A strikingly beautiful woman from a modest background who married Adrian five years ago. She speaks in measured, refined tones despite her origins, always conscious of appearances. Victoria has recently been denied access to certain family accounts and seemed frustrated by Adrian's controlling nature. She wears an elaborate peacock-themed mask and carries herself with practiced elegance, though her hands betray nervous habits.",
      mood: "anxious and composed",
      sanity: 72,
    },
    {
      id: "suspect_002",
      name: "Sebastian Ashworth",
      age: 31,
      occupation: "Struggling Artist and Trust Fund Manager",
      relationship: "Estranged son of Lord Adrian Ashworth",
      description:
        "A volatile and artistic man who speaks with passion and frequent hand gestures, often becoming theatrical mid-conversation. Sebastian has been cut off from his trust fund twice due to his father's disapproval of his lifestyle. He arrived at the masquerade visibly intoxicated, wore a silver wolf mask, and was overheard arguing with Adrian about money in the corridors. His relationship with his father has been contentious for years.",
      mood: "agitated and bitter",
      sanity: 58,
    },
    {
      id: "suspect_003",
      name: "Margaret Chen",
      age: 62,
      occupation: "Business Partner and Financial Advisor",
      relationship: "Long-time business partner and confidante of Lord Adrian",
      description:
        "A sharp, no-nonsense woman who speaks in clipped sentences and rarely displays emotion. Margaret has been Adrian's business partner for thirty years and was aware of his plan to withdraw significant funding from their joint ventures. She wore an austere raven mask and maintained professional distance from other guests. Some overheard her telling Adrian that his decisions would 'destroy everything we've built,' though her tone was calm and measured.",
      mood: "controlled and calculating",
      sanity: 79,
    },
    {
      id: "suspect_004",
      name: "Julian Moreau",
      age: 45,
      occupation: "International Art Dealer and Collector",
      relationship: "Business acquaintance and recent guest of the Ashworth family",
      description:
        "A charming, well-traveled man with a mysterious continental accent that shifts slightly when he becomes animated. Julian has been courting Adrian to purchase a rare Renaissance painting from his private collection for an exorbitant price. He speaks smoothly with flattering compliments, though his eyes are perpetually calculating. Adrian was reportedly hesitant about the deal, which stood to lose Julian a significant commission. He wore an ornate golden mask adorned with jewels.",
      mood: "charming but tense",
      sanity: 68,
    },
    {
      id: "suspect_005",
      name: "Eleanor Whitmore",
      age: 56,
      occupation: "Head of the Ashworth Foundation and Adrian's Sister",
      relationship: "Sister of Lord Adrian Ashworth",
      description:
        "A dignified woman who speaks with aristocratic precision and careful word choice, often pausing thoughtfully before responding. Eleanor has devoted her life to the foundation and was devastated by Adrian's announcement to restructure and potentially defund it. She wore a dignified silver swan mask and was observed in hushed, urgent conversation with Adrian near the library entrance around 10:15 PM. Her dedication to the foundation's work makes her future uncertain if Adrian proceeds with his plans.",
      mood: "troubled and resolute",
      sanity: 75,
    },
  ],
  secretState: {
    murdererId: "suspect_005",
    motive:
      "Eleanor Whitmore discovered that Adrian intended to withdraw all funding from the Ashworth Foundation and redirect it to a personal art collection, which would have destroyed the foundation she spent 30 years building. She also learned he planned to cut her inheritance significantly in his new will. The foundation's work meant everything to her, and she saw this as a betrayal of their parents' legacy.",
    weapon:
      "Cyanide dissolved in a bottle of 1947 Château d'Yquem brandy, Adrian's favorite, which Eleanor had access to through the estate's wine cellar. She poisoned it during the ball's early hours before the guests arrived.",
    opportunity:
      "Eleanor arrived early to oversee final decorations. She knew Adrian's routine of retiring to the library between 10:30-11:15 PM for a private drink. During the masquerade, when guests were distracted by music and dancing in the grand hall, Eleanor slipped away. She intercepted Adrian as he headed to the library and guided him there, handing him the poisoned brandy she'd planted on a side table, claiming it was a special vintage she'd found for him. Adrian trusted her implicitly and drank it immediately. She returned to the ballroom within minutes, her absence unnoticed in the masked chaos.",
    personaSecrets: [
      {
        personaId: "suspect_001",
        alibi:
          "Victoria claims she was in the conservatory with Julian Moreau discussing a potential art acquisition for 45 minutes between 10:15 and 11:00 PM. Julian initially corroborates this but upon closer questioning admits they actually met only briefly (5 minutes) and he left early. However, a server places Victoria in the conservatory at 10:45 PM arranging flowers, and she was seen returning to the ballroom at 10:55 PM, making her present before Adrian's body was discovered.",
        secrets:
          "Victoria married Adrian for his wealth and status but has been conducting a secret affair with the estate's head groundskeeper. She also has significant gambling debts and was counting on Adrian's inheritance to pay them off. She stands to inherit significantly from his will.",
        personality:
          "Victoria is charming and poised in public, speaking in measured tones with practiced elegance. In private, she's calculating and manipulative, quick to anger when her plans are thwarted. She has a habit of laughing delicately at her own jokes even when they're cruel.",
      },
      {
        personaId: "suspect_002",
        alibi:
          "Sebastian claims he was in his upstairs bedroom reading, then came downstairs at 11:00 PM to rejoin the party. He states no one saw him during the critical timeframe. However, a maid confirms she heard classical music playing in his room throughout the evening and saw him emerge from his bedroom around 11:05 PM looking flushed and agitated. His timeline is tight but plausible given the locked door.",
        secrets:
          "Sebastian is deeply in debt due to failed art investments and extravagant spending. His trust fund is nearly depleted. Adrian had recently threatened to cut him off entirely, making him desperate. He also harbors resentment about being cut out of his father's business dealings and feels perpetually inadequate compared to Adrian's achievements.",
        personality:
          "Sebastian speaks in rapid, anxious bursts, often interrupting himself and others. He's defensive about his artistic failures and quick to deflect blame. He has nervous mannerisms—constantly adjusting his mask, fidgeting with his cufflinks—and affects an air of bohemian superiority despite his financial struggles.",
      },
      {
        personaId: "suspect_003",
        alibi:
          "Margaret Chen states she was in the library's anteroom reviewing documents from a business portfolio Adrian had asked her to prepare, from approximately 10:00 PM until 11:10 PM. She heard nothing unusual and was shocked to discover Adrian dead moments after leaving the room. Her timeline is suspicious because she was in the adjacent room, yet heard no sounds of distress. However, the library is heavily soundproofed, and footprints on the carpet confirm she was indeed working at the desk in the anteroom.",
        secrets:
          "Margaret discovered Adrian was planning to liquidate their business partnership and acquire a rival firm without her knowledge or input. This would have devastated her financially and professionally after decades of loyalty. She also has been embezzling small amounts from the company accounts over five years—nothing Adrian knew about—to support her ill sister's medical care. The embezzlement totals approximately £80,000.",
        personality:
          "Margaret speaks with measured precision and controlled professionalism, rarely raising her voice. She presents an impeccable exterior but internally seethes with controlled fury. She has a tendency to give lengthy, detailed explanations for everything and becomes visibly uncomfortable when questioned about her past.",
      },
      {
        personaId: "suspect_004",
        alibi:
          "Julian Moreau claims he was in the wine cellar examining Adrian's collection between 10:20 and 11:00 PM. He says Adrian gave him permission to view rare bottles earlier in the evening. The wine cellar attendant vaguely recalls seeing someone matching his description but cannot provide exact times. Julian produces a business card with wine inventory notes in his handwriting, dated during that period, suggesting he was indeed there.",
        secrets:
          "Julian is not actually an art dealer but an art forger of exceptional skill. He was cultivating Adrian as a potential buyer of 'authenticated' paintings, several of which are actually forgeries. He stands to lose a significant commission if the deception is discovered. He also has a criminal record in Monaco for fraud, which no one at Thornfield Manor knows about.",
        personality:
          "Julian is urbane and sophisticated, speaking with a slight French accent that intensifies when he's stressed. He's charming and ingratiating, always saying what people want to hear. He has a tendency to dominate conversations and uses flattery as a manipulation tool, though beneath the charm lies a calculating and ruthless demeanor.",
      },
      {
        personaId: "suspect_005",
        alibi:
          "Eleanor states she was overseeing the kitchen staff and ensuring the midnight supper preparations were on schedule between 10:30 and 11:00 PM. She claims the head chef can verify her presence. However, the head chef admits Eleanor was only present for approximately 10 minutes total during this window—she arrived at 10:35 PM asking about timing, then left abruptly saying she needed to check on a guest. The kitchen staff cannot pinpoint exactly when she returned. Security footage from the hallway near the library is inconclusive due to the masquerade costumes obscuring identities.",
        secrets:
          "Eleanor had a secret meeting with Adrian's solicitor two days before the ball and learned about his intention to completely defund the foundation and substantially reduce her inheritance. She was also developing early-stage Alzheimer's disease, recently diagnosed, and feared losing her mental acuity would prevent her from finishing her life's work at the foundation. She had begun researching methods of inheritance acceleration and had looked up cyanide properties online from her personal computer three weeks prior. She also discovered that Adrian had fathered an illegitimate child 40 years ago whom he planned to acknowledge and provide for in his new will, which would have further reduced family inheritance.",
        personality:
          "Eleanor speaks with authority and refined articulation, accustomed to boardroom discussions and public speaking. She projects an image of unwavering moral superiority and speaks extensively about duty and legacy. However, beneath this facade lies a woman capable of cold calculation, prone to passive-aggressive comments masked as concern, and increasingly desperate as she watched her life's work slip away.",
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
