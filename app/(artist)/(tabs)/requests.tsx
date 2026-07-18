import { Screen } from "../../../src/ui/Screen";
import { EmptyState } from "../../../src/ui/EmptyState";

export default function Requests() {
  return (
    <Screen padded={false}>
      <EmptyState
        icon="file-tray-full"
        title="No open requests"
        body="New booking enquiries land here. Review the brief, quote a price and offer a slot without leaving the app."
      />
    </Screen>
  );
}
