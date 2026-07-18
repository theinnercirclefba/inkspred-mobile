import { Screen } from "../../../src/ui/Screen";
import { EmptyState } from "../../../src/ui/EmptyState";

export default function Messages() {
  return (
    <Screen padded={false}>
      <EmptyState
        icon="chatbubble-ellipses"
        title="No messages yet"
        body="Every client conversation in one place — references, quotes and aftercare, kept tidy per booking."
      />
    </Screen>
  );
}
