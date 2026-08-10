const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const xmlPath = path.join(__dirname, '../documentos/Planificacion Parques Chile v2.pod.xml');
const xmlString = fs.readFileSync(xmlPath, 'utf8');

const dom = new JSDOM("");
const DOMParser = dom.window.DOMParser;
const parser = new DOMParser();
const xmlDoc = parser.parseFromString(xmlString, "application/xml");

const projectNode = Array.from(xmlDoc.children).find(c => c.localName === 'Project');
const tasksNode = Array.from(projectNode.children).find(c => c.localName === 'Tasks');
const taskNodes = Array.from(tasksNode.children).filter(c => c.localName === 'Task');

function getChildNodeText(node, localName) {
  const children = Array.from(node.children);
  const child = children.find(c => c.localName === localName);
  return child && child.textContent ? child.textContent.trim() : null;
}

let countValidStart = 0;
let countValidEnd = 0;
let invalidTasks = [];

taskNodes.forEach((tNode, index) => {
  const name = getChildNodeText(tNode, 'Name');
  const start = getChildNodeText(tNode, 'Start');
  const finish = getChildNodeText(tNode, 'Finish');
  
  let startValid = start && !isNaN(Date.parse(start));
  let endValid = finish && !isNaN(Date.parse(finish));

  if (startValid) countValidStart++;
  if (endValid) countValidEnd++;

  if (!startValid || !endValid) {
    invalidTasks.push({ index: index + 1, name, start, finish });
  }
});

const { parseISO, min, max, startOfDay, endOfDay, addDays } = require('date-fns');

let startDates = [];
let endDates = [];

taskNodes.forEach((tNode) => {
  const start = getChildNodeText(tNode, 'Start');
  const finish = getChildNodeText(tNode, 'Finish');
  
  if (start) startDates.push(startOfDay(parseISO(start)));
  if (finish) endDates.push(endOfDay(parseISO(finish)));
});

const projectStart = min(startDates);
const projectEnd = max(endDates);

const { differenceInDays } = require('date-fns');
const cellWidth = 32;

console.log("\n--- Timeline Bar Math ---");
taskNodes.slice(0, 5).forEach((tNode, index) => {
  const name = getChildNodeText(tNode, 'Name');
  const start = getChildNodeText(tNode, 'Start');
  const finish = getChildNodeText(tNode, 'Finish');
  
  if (!start || !finish) return;
  
  const taskStart = startOfDay(parseISO(start));
  const taskEnd = startOfDay(parseISO(finish));
  
  const offsetDays = differenceInDays(taskStart, startOfDay(projectStart));
  const durationDays = differenceInDays(taskEnd, taskStart) + 1;
  
});

console.log("\n--- Absolute Date Range ---");
let allStarts = [];
let allEnds = [];

taskNodes.forEach((tNode) => {
  const start = getChildNodeText(tNode, 'Start');
  const finish = getChildNodeText(tNode, 'Finish');
  if (start) allStarts.push(parseISO(start));
  if (finish) allEnds.push(parseISO(finish));
});

console.log('Absolute Min Start:', min(allStarts));
console.log('Absolute Max End:', max(allEnds));
const rangeDays = differenceInDays(max(allEnds), min(allStarts));
console.log('Total Days in Range:', rangeDays);

