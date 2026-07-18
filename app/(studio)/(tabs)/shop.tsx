import { Screen } from "../../../src/ui/Screen";
import { EmptyState } from "../../../src/ui/EmptyState";

export default function Shop() {
  return (
    <Screen padded={false}>
      <EmptyState
        icon="storefront"
        title="Your shop front"
        body="How the studio appears to clients — chair count, opening hours and the roster on shift today — is set up here."
      />
    </Screen>
  );
}
