import { Screen } from "../../../src/ui/Screen";
import { EmptyState } from "../../../src/ui/EmptyState";

export default function Enquiries() {
  return (
    <Screen padded={false}>
      <EmptyState
        icon="mail"
        title="No enquiries yet"
        body="Walk-in and website enquiries arrive here, ready to route to the right artist for the style requested."
      />
    </Screen>
  );
}
