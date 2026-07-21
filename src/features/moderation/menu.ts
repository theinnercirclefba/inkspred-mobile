/**
 * The Report / Block action menu (Apple Guideline 1.2 UGC controls), presented
 * from the "⋯" button on any surface that shows another user's content — an
 * artist profile or a message thread. iOS gets a native action sheet; other
 * platforms fall back to an Alert so the flow still works.
 *
 * Usage:
 *   presentModerationMenu({
 *     subjectLabel: artist.displayName,
 *     targetType: "artist",
 *     targetId: artist.id,
 *     blockUserId: artist.userId,
 *     onBlocked: () => router.back(),
 *   });
 */
import { ActionSheetIOS, Alert, Platform } from "react-native";
import {
  REPORT_REASONS,
  blockUser,
  reportContent,
  type ReportTargetType,
} from "./data";

export interface ModerationMenuOptions {
  /** Human label for the subject, used in copy (e.g. the artist's name). */
  subjectLabel: string;
  /** What a report points at. */
  targetType: ReportTargetType;
  /** The reported object's id (artist id, thread/user id, …). */
  targetId: string;
  /** User id to block. Omit/null to hide the Block action (e.g. reporting an image). */
  blockUserId?: string | null;
  /** Runs after a successful block — e.g. navigate away or refresh a list. */
  onBlocked?: () => void;
}

/** Open the top-level Report / Block sheet. */
export function presentModerationMenu(opts: ModerationMenuOptions): void {
  const actions: { label: string; run: () => void }[] = [
    { label: "Report…", run: () => presentReportReasons(opts) },
  ];
  if (opts.blockUserId) {
    actions.push({
      label: `Block ${opts.subjectLabel}`,
      run: () => confirmBlock(opts),
    });
  }
  presentSheet({
    title: opts.subjectLabel,
    options: actions.map((a) => a.label),
    destructiveIndex: opts.blockUserId ? actions.length - 1 : undefined,
    onPick: (i) => actions[i]?.run(),
  });
}

function presentReportReasons(opts: ModerationMenuOptions): void {
  presentSheet({
    title: "Report — pick a reason",
    options: [...REPORT_REASONS],
    onPick: async (i) => {
      const reason = REPORT_REASONS[i];
      if (!reason) return;
      try {
        await reportContent({
          targetType: opts.targetType,
          targetId: opts.targetId,
          reason,
        });
        Alert.alert(
          "Report received",
          "Thanks for flagging this. Our team reviews every report and will take action if it breaks our rules.",
        );
      } catch {
        Alert.alert(
          "Couldn't send report",
          "Please check your connection and try again.",
        );
      }
    },
  });
}

function confirmBlock(opts: ModerationMenuOptions): void {
  const blockUserId = opts.blockUserId;
  if (!blockUserId) return;
  Alert.alert(
    `Block ${opts.subjectLabel}?`,
    "They won't be able to message you, and you won't see their profile or content. You can unblock them later.",
    [
      { text: "Cancel", style: "cancel" },
      {
        text: "Block",
        style: "destructive",
        onPress: async () => {
          try {
            await blockUser(blockUserId);
            opts.onBlocked?.();
            Alert.alert("Blocked", `You've blocked ${opts.subjectLabel}.`);
          } catch {
            Alert.alert(
              "Couldn't block",
              "Please check your connection and try again.",
            );
          }
        },
      },
    ],
  );
}

/** Native iOS action sheet; Alert fallback elsewhere. */
function presentSheet(args: {
  title: string;
  options: string[];
  destructiveIndex?: number;
  onPick: (index: number) => void;
}): void {
  if (Platform.OS === "ios") {
    ActionSheetIOS.showActionSheetWithOptions(
      {
        title: args.title,
        options: [...args.options, "Cancel"],
        cancelButtonIndex: args.options.length,
        destructiveButtonIndex: args.destructiveIndex,
        userInterfaceStyle: "dark",
      },
      (i) => {
        if (i < args.options.length) args.onPick(i);
      },
    );
    return;
  }
  Alert.alert(args.title, undefined, [
    ...args.options.map((label, i) => ({
      text: label,
      onPress: () => args.onPick(i),
    })),
    { text: "Cancel", style: "cancel" as const },
  ]);
}
