// Shared with the old hint panels so both looks say the same thing.
export function hintOutcome(answer, bb) {
  const tier = answer.juryTier;
  const isWinner = tier === "Winner", isFinalist = tier === "Finalist";
  const tierLabel = isWinner || isFinalist ? "Finalist" : tier === "Jury" ? "Juror" : "Pre-Jury";
  const finale = bb ? "Made it to Finale Night" : "Survived until Final Tribal Council";
  const outcomeText = isWinner ? `${finale} (Won)`
    : isFinalist ? finale
    : bb ? `Evicted during Week ${answer.weekOut ?? "?"}, Day ${answer.day ?? "?"}`
    : `Eliminated during Episode ${answer.episodeOut ?? "?"}, Day ${answer.day ?? "?"}`;
  return { tierLabel, outcomeText };
}
