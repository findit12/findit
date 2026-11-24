// Lab 5, section 2: JavaScript practice, adapted to the FindIt project (campus lost and found).
// Run with: node js-practice.js
// This file is a learning exercise. The application itself is TypeScript only (SRS NFR-MAINT-03).

// 2.1 Variables and data types ------------------------------------------------------------
const platformName = 'FindIt';
let announcementsToday = 7;
let receptionOpen = true;

console.log(`Welcome to ${platformName}! ${announcementsToday} announcements were declared today.`);
receptionOpen = false;
console.log(
  receptionOpen
    ? 'The reception desk is open: you can drop your found object there.'
    : 'The reception desk is closed: keep the object and start a discussion instead.',
);

// 2.2 Arrays and loops --------------------------------------------------------------------
const foundObjects = ['Blue backpack', 'Black wallet', 'Student card', 'Silver bottle', 'Car keys'];

let index = 1;
for (const title of foundObjects) {
  console.log(`Object #${index}: ${title}`);
  index += 1;
}

foundObjects.push('Grey scarf');
console.log(`Updated count: ${foundObjects.length} found objects`);

function findObject(title) {
  return foundObjects.includes(title) ? 'Object found' : 'Object not found';
}
console.log(findObject('Black wallet'));
console.log(findObject('Red umbrella'));

// 2.3 Objects and nested data -------------------------------------------------------------
const announcement = {
  title: 'Black wallet',
  type: 'found',
  tags: ['leather', 'black'],
  author: { name: 'Alice Martin', campusYear: 'A4' },
};

console.log(`Author: ${announcement.author.name}`);
console.log(`Number of tags: ${announcement.tags.length}`);
console.log(`${announcement.title} was declared by ${announcement.author.name} (${announcement.author.campusYear}).`);
announcement.tags.push('card holder');
console.log('Updated announcement:', announcement);

// 2.4 Functions and array filtering -------------------------------------------------------
const announcements = [
  { id: 1, title: 'Blue backpack', daysOld: 3 },
  { id: 2, title: 'Black wallet', daysOld: 45 },
  { id: 3, title: 'Student card', daysOld: 80 },
];

// FR-20: announcements unclaimed for a long time are archived after 90 days.
function filterOlderThan(minDays) {
  return announcements.filter((item) => item.daysOld > minDays);
}

function addAnnouncement(title, daysOld) {
  announcements.push({ id: announcements.length + 1, title, daysOld });
}

console.log('Older than 30 days:', filterOlderThan(30));
addAnnouncement('Silver bottle', 1);
console.log('Updated list:', announcements);

// 2.5 Modularization: see practice/findit-data.mjs and practice/main.mjs (node practice/main.mjs)

// 2.6 Error handling and validation -------------------------------------------------------
function createClaim(announcementId, claimant, proof) {
  if (!announcementId || !claimant || !proof) {
    throw new Error('Missing required fields');
  }
  return { announcementId, claimant, proof };
}

try {
  console.log(createClaim(12, 'Bob', 'cat sticker on the back'));
  console.log(createClaim(12, 'Bob')); // should trigger the error
} catch (err) {
  console.error('Error:', err.message);
}

// 2.7 Asynchronous code -------------------------------------------------------------------
function getPlatformStats() {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({ name: platformName, declared: 120, returned: 48 });
    }, 1000);
  });
}

async function showStats() {
  console.log('Fetching platform statistics...');
  const stats = await getPlatformStats();
  console.log('Statistics loaded:', stats);
}

showStats();
