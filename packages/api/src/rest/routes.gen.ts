// Generert fra rutene i ./routes (samme stier som API-et i Sporty Native). Mest spesifikke
// mønstre først, så f.eks. /groups/managed treffes før /groups/:groupId.

import * as r6 from "./routes/announcements/[announcementId]/comments";
import * as r33 from "./routes/announcements/[announcementId]/index";
import * as r40 from "./routes/announcements/index";
import * as r41 from "./routes/contacts";
import * as r34 from "./routes/conversations/[conversationId]/index";
import * as r7 from "./routes/conversations/[conversationId]/messages";
import * as rMessage from "./routes/conversations/[conversationId]/messages/[messageId]/index";
import * as rMessageReactions from "./routes/conversations/[conversationId]/messages/[messageId]/reactions";
import * as r8 from "./routes/conversations/[conversationId]/read";
import * as r26 from "./routes/conversations/direct";
import * as r42 from "./routes/conversations/index";
import * as r9 from "./routes/events/[eventId]/attendance";
import * as r10 from "./routes/events/[eventId]/collective-fine";
import * as r35 from "./routes/events/[eventId]/index";
import * as rMatchStat from "./routes/events/[eventId]/match-facts/[statId]";
import * as rMatchFacts from "./routes/events/[eventId]/match-facts/index";
import * as r11 from "./routes/events/[eventId]/result";
import * as r43 from "./routes/events/index";
import * as r36 from "./routes/fines/[fineId]";
import * as rFineImage from "./routes/fines/[fineId]/image";
import * as r44 from "./routes/fines/index";
import * as r27 from "./routes/fines/mine";
import * as r12 from "./routes/groups/[groupId]/announcements";
import * as r13 from "./routes/groups/[groupId]/events";
import * as r3 from "./routes/groups/[groupId]/export/attendance";
import * as r4 from "./routes/groups/[groupId]/export/results";
import * as r14 from "./routes/groups/[groupId]/files";
import * as r15 from "./routes/groups/[groupId]/fines";
import * as r37 from "./routes/groups/[groupId]/index";
import * as r16 from "./routes/groups/[groupId]/laws";
import * as rMatchStatType from "./routes/groups/[groupId]/match-stat-types/[typeId]";
import * as rMatchStatTypes from "./routes/groups/[groupId]/match-stat-types/index";
import * as r0 from "./routes/groups/[groupId]/members/[userId]/inactive";
import * as r1 from "./routes/groups/[groupId]/members/[userId]/position";
import * as r2 from "./routes/groups/[groupId]/members/[userId]/role";
import * as rMemberSubgroups from "./routes/groups/[groupId]/members/[userId]/subgroups";
import * as r17 from "./routes/groups/[groupId]/members/index";
import * as r18 from "./routes/groups/[groupId]/payments";
import * as r19 from "./routes/groups/[groupId]/polls";
import * as r5 from "./routes/groups/[groupId]/positions/[positionId]";
import * as r20 from "./routes/groups/[groupId]/positions/index";
import * as r21 from "./routes/groups/[groupId]/subgroups";
import * as r45 from "./routes/groups/index";
import * as r28 from "./routes/groups/managed";
import * as r46 from "./routes/health";
import * as r47 from "./routes/me/index";
import * as r29 from "./routes/me/settings";
import * as r22 from "./routes/notifications/[notificationId]/read";
import * as r48 from "./routes/notifications/index";
import * as r30 from "./routes/notifications/read-all";
import * as rPaymentConfirmation from "./routes/payments/[paymentId]/confirmations/[userId]";
import * as r23 from "./routes/payments/[paymentId]/paid";
import * as r49 from "./routes/places/index";
import * as r31 from "./routes/places/search";
import * as r24 from "./routes/polls/[pollId]/comments";
import * as r38 from "./routes/polls/[pollId]/index";
import * as r25 from "./routes/polls/[pollId]/vote";
import * as r50 from "./routes/push-tokens/index";
import * as r32 from "./routes/push-tokens/test";
import * as r51 from "./routes/unread";
import * as r39 from "./routes/uploads/[uploadId]";
import * as r52 from "./routes/uploads/index";
import * as rUserImage from "./routes/users/[userId]/image";
import * as r53 from "./routes/users/index";

export const routes = [
	{ pattern: "/fines/:fineId/image", module: rFineImage },
	{ pattern: "/groups/:groupId/members/:userId/inactive", module: r0 },
	{ pattern: "/groups/:groupId/members/:userId/position", module: r1 },
	{
		pattern: "/groups/:groupId/members/:userId/subgroups",
		module: rMemberSubgroups,
	},
	{ pattern: "/groups/:groupId/members/:userId/role", module: r2 },
	{ pattern: "/groups/:groupId/export/attendance", module: r3 },
	{ pattern: "/groups/:groupId/export/results", module: r4 },
	{ pattern: "/groups/:groupId/positions/:positionId", module: r5 },
	{
		pattern: "/groups/:groupId/match-stat-types/:typeId",
		module: rMatchStatType,
	},
	{ pattern: "/events/:eventId/match-facts/:statId", module: rMatchStat },
	{
		pattern: "/conversations/:conversationId/messages/:messageId/reactions",
		module: rMessageReactions,
	},
	{
		pattern: "/conversations/:conversationId/messages/:messageId",
		module: rMessage,
	},
	{ pattern: "/announcements/:announcementId/comments", module: r6 },
	{ pattern: "/conversations/:conversationId/messages", module: r7 },
	{ pattern: "/conversations/:conversationId/read", module: r8 },
	{ pattern: "/events/:eventId/attendance", module: r9 },
	{ pattern: "/events/:eventId/collective-fine", module: r10 },
	{ pattern: "/events/:eventId/result", module: r11 },
	{ pattern: "/events/:eventId/match-facts", module: rMatchFacts },
	{ pattern: "/groups/:groupId/announcements", module: r12 },
	{ pattern: "/groups/:groupId/events", module: r13 },
	{ pattern: "/groups/:groupId/files", module: r14 },
	{ pattern: "/groups/:groupId/fines", module: r15 },
	{ pattern: "/groups/:groupId/laws", module: r16 },
	{ pattern: "/groups/:groupId/members", module: r17 },
	{ pattern: "/groups/:groupId/payments", module: r18 },
	{ pattern: "/groups/:groupId/polls", module: r19 },
	{ pattern: "/groups/:groupId/positions", module: r20 },
	{ pattern: "/groups/:groupId/match-stat-types", module: rMatchStatTypes },
	{ pattern: "/groups/:groupId/subgroups", module: r21 },
	{ pattern: "/notifications/:notificationId/read", module: r22 },
	{
		pattern: "/payments/:paymentId/confirmations/:userId",
		module: rPaymentConfirmation,
	},
	{ pattern: "/payments/:paymentId/paid", module: r23 },
	{ pattern: "/polls/:pollId/comments", module: r24 },
	{ pattern: "/polls/:pollId/vote", module: r25 },
	{ pattern: "/conversations/direct", module: r26 },
	{ pattern: "/fines/mine", module: r27 },
	{ pattern: "/groups/managed", module: r28 },
	{ pattern: "/me/settings", module: r29 },
	{ pattern: "/notifications/read-all", module: r30 },
	{ pattern: "/places/search", module: r31 },
	{ pattern: "/push-tokens/test", module: r32 },
	{ pattern: "/announcements/:announcementId", module: r33 },
	{ pattern: "/conversations/:conversationId", module: r34 },
	{ pattern: "/events/:eventId", module: r35 },
	{ pattern: "/fines/:fineId", module: r36 },
	{ pattern: "/groups/:groupId", module: r37 },
	{ pattern: "/polls/:pollId", module: r38 },
	{ pattern: "/uploads/:uploadId", module: r39 },
	{ pattern: "/announcements", module: r40 },
	{ pattern: "/contacts", module: r41 },
	{ pattern: "/conversations", module: r42 },
	{ pattern: "/events", module: r43 },
	{ pattern: "/fines", module: r44 },
	{ pattern: "/groups", module: r45 },
	{ pattern: "/health", module: r46 },
	{ pattern: "/me", module: r47 },
	{ pattern: "/notifications", module: r48 },
	{ pattern: "/places", module: r49 },
	{ pattern: "/push-tokens", module: r50 },
	{ pattern: "/unread", module: r51 },
	{ pattern: "/uploads", module: r52 },
	{ pattern: "/users/:userId/image", module: rUserImage },
	{ pattern: "/users", module: r53 },
] as const;
