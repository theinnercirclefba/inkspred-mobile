import { Screen } from "../../../src/ui/Screen";
import { EmptyState } from "../../../src/ui/EmptyState";

export default function Artists() {
  return (
    <Screen padded={false}>
      <EmptyState
        icon="people"
        title="No artists yet"
        body="Invite your artists, set their chair rents or splits, and see everyone's diary in one shared view."
      />
    </Screen>
  );
}
