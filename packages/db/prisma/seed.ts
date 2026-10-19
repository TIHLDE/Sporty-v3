// Fyller den lokale databasen med eksempeldata. Kjøres med `bun run db:seed`.
// Sletter alle Sporty-data som ligger der fra før (ikke innloggingene til Better Auth), så seed
// kan kjøres så ofte man vil.

import { existsSync } from 'node:fs';
import path from 'node:path';

import { createPrismaClient } from '../src/index';

import * as data from './seed-data';

// Repo-roten eier .env (Bun laster den ikke selv i dette prosjektet, se bunfig.toml).
const rootEnvFile = path.join(import.meta.dirname, '../../../.env');
if (!process.env.DATABASE_URL && existsSync(rootEnvFile)) process.loadEnvFile(rootEnvFile);

const prisma = createPrismaClient({ DATABASE_URL: process.env.DATABASE_URL ?? '' });

async function main() {
  await prisma.$executeRawUnsafe(`
    TRUNCATE "Person", "Group", "Membership", "Event", "Attendance", "Announcement", "Poll",
      "PollOption", "PollVote", "Law", "Fine", "PaymentRequest", "PaymentConfirmation",
      "GroupFile", "Notification", "Conversation", "ConversationMember", "Message", "Place", "PollComment", "Upload", "AnnouncementComment", "GroupPosition", "FineRequest", "PushToken", "NotificationSettings" CASCADE
  `);

  await prisma.person.createMany({ data: data.users });

  // Hovedgrupper før undergrupper, ellers mangler parentId-referansen.
  const sortedGroups = [...data.groups].sort((a, b) => Number(a.parentId !== null) - Number(b.parentId !== null));
  for (const group of sortedGroups) await prisma.group.create({ data: group });

  await prisma.groupPosition.createMany({ data: data.positions });
  await prisma.membership.createMany({ data: data.memberships });
  await prisma.law.createMany({ data: data.laws });

  await prisma.place.createMany({ data: data.places.map((place) => ({ ...place, groupId: null })) });

  for (const event of data.events) {
    await prisma.event.create({
      data: {
        id: event.id,
        groupId: event.groupId,
        title: event.title,
        description: event.description,
        locationName: event.location.name,
        latitude: event.location.latitude,
        longitude: event.location.longitude,
        startsAt: new Date(event.start),
        endsAt: event.end ? new Date(event.end) : null,
        attendances: {
          create: Object.entries(event.attendance).map(([userId, status]) => ({ userId, status })),
        },
      },
    });
  }

  await prisma.announcement.createMany({
    data: data.announcements.map((a) => ({ ...a, createdAt: new Date(a.createdAt) })),
  });

  for (const poll of data.polls) {
    await prisma.poll.create({
      data: {
        id: poll.id,
        groupId: poll.groupId,
        question: poll.question,
        closesAt: new Date(poll.closesAt),
        options: {
          create: poll.options.map((option, position) => ({ id: option.id, label: option.label, position })),
        },
      },
    });
    await prisma.pollVote.createMany({
      data: poll.options.flatMap((option) =>
        option.voterIds.map((userId) => ({ pollId: poll.id, optionId: option.id, userId }))
      ),
    });
  }

  await prisma.fine.createMany({
    data: data.fines.map((fine) => ({ ...fine, createdAt: new Date(fine.createdAt) })),
  });

  for (const { paidUserIds, ...payment } of data.paymentRequests) {
    await prisma.paymentRequest.create({
      data: {
        ...payment,
        dueDate: new Date(payment.dueDate),
        createdAt: new Date(payment.createdAt),
        confirmations: { create: paidUserIds.map((userId) => ({ userId })) },
      },
    });
  }

  await prisma.groupFile.createMany({
    data: data.files.map((file) => ({ ...file, uploadedAt: new Date(file.uploadedAt) })),
  });

  // Varslene i eksempeldataene er til standardbrukeren.
  await prisma.notification.createMany({
    data: data.notifications.map((n) => ({
      ...n,
      userId: data.DEFAULT_USER_ID,
      createdAt: new Date(n.createdAt),
    })),
  });

  const now = new Date();
  for (const conversation of data.conversations) {
    await prisma.conversation.create({
      data: {
        id: conversation.id,
        title: conversation.title,
        groupId: conversation.groupId,
        members: {
          // Standardbrukeren har ikke lest samtaler som er markert med uleste meldinger.
          create: conversation.memberIds.map((userId) => ({
            userId,
            lastReadAt: userId === data.DEFAULT_USER_ID && conversation.unread > 0 ? null : now,
          })),
        },
        messages: {
          create: conversation.messages.map((m) => ({ ...m, sentAt: new Date(m.sentAt) })),
        },
      },
    });
  }

  const counts = await Promise.all([prisma.person.count(), prisma.group.count(), prisma.place.count()]);
  console.log(`Seed ferdig: ${counts[0]} brukere, ${counts[1]} grupper, ${counts[2]} stedsforslag.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
