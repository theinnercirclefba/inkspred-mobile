import { Screen } from "../../../src/ui/Screen";
import { EmptyState } from "../../../src/ui/EmptyState";

export default function Money() {
  return (
    <Screen padded={false}>
      <EmptyState
        icon="wallet"
        title="No takings yet"
        body="Deposits, payouts and spread-the-cost plans, totalled in pounds. Your earnings picture builds as you take work."
      />
    </Screen>
  );
}
