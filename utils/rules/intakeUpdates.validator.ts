import intakeRules from "./intakeUpdates.rules.json";

export function validateIntakeActions(
  eligibilityStatus: string,
  uiActions: string[]
): string[] {
  if (!(eligibilityStatus in intakeRules)) {
    throw new Error(
      `No Intake Update rules defined for eligibility status: ${eligibilityStatus}`
    );
  }

  const requiredActions =
    intakeRules[eligibilityStatus as keyof typeof intakeRules];

  const normalizedUIActions = uiActions.map((a) => a.trim());

  return requiredActions.filter(
    (action) => !normalizedUIActions.includes(action)
  );
}
