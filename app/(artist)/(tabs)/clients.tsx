import { Screen } from "../../../src/ui/Screen";
import { EmptyState } from "../../../src/ui/EmptyState";

export default function Clients() {
  return (
    <Screen padded={false}>
      <EmptyState
        icon="people"
        title="No clients yet"
        body="Build a picture of every client — past pieces, healed photos, consent forms and what they're saving towards next."
      />
    </Screen>
  );
}
