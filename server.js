const express = require('express');
const path = require('path');
const fs = require('fs').promises;

const app = express();
const PORT = process.env.PORT || 3000;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));

async function getCourseStructure() {
  const subjects = ['Math', 'Science', 'English', 'SocialScience'];
  const structure = {};

  for (const subject of subjects) {
    structure[subject] = {};

    for (let year = 1; year <= 13; year++) {
      const yearPath = path.join(__dirname, 'courses', subject, `Year${year}`);

      try {
        const topics = await fs.readdir(yearPath);
        structure[subject][year] = [];

        for (const topic of topics) {
          const topicPath = path.join(yearPath, topic);
          const stat = await fs.stat(topicPath);

          if (stat.isDirectory()) {
            const files = await fs.readdir(topicPath);
            const lessons = files.filter(f => f.endsWith('.json'));

            structure[subject][year].push({
              topicName: topic.replace(/^\d+_/, '').replace(/_/g, ' '),
              topicSlug: topic,
              lessonCount: lessons.length
            });
          }
        }
      } catch (err) {
        structure[subject][year] = [];
      }
    }
  }

  return structure;
}

app.get('/', async (req, res) => {
  const structure = await getCourseStructure();
  res.render('index', { structure });
});

app.get('/subject/:subject', async (req, res) => {
  const { subject } = req.params;
  const structure = await getCourseStructure();

  if (!structure[subject]) {
    return res.status(404).send('Subject not found');
  }

  res.render('subject', { subject, years: structure[subject] });
});

app.get('/subject/:subject/year/:year', async (req, res) => {
  const { subject, year } = req.params;
  const structure = await getCourseStructure();

  if (!structure[subject] || !structure[subject][year]) {
    return res.status(404).send('Not found');
  }

  res.render('year', {
    subject,
    year: parseInt(year),
    topics: structure[subject][year]
  });
});

app.get('/lesson/:subject/:year/:topic/:lesson', async (req, res) => {
  const { subject, year, topic, lesson } = req.params;
  const lessonPath = path.join(
    __dirname,
    'courses',
    subject,
    `Year${year}`,
    topic,
    `lesson${lesson}.json`
  );

  try {
    const lessonData = await fs.readFile(lessonPath, 'utf-8');
    const lessonContent = JSON.parse(lessonData);

    res.render('lesson', {
      lesson: lessonContent,
      subject,
      year,
      topic,
      lessonNumber: lesson
    });
  } catch (err) {
    res.status(404).send('Lesson not found');
  }
});

app.listen(PORT, () => {
  console.log(`Learning app running on http://localhost:${PORT}`);
});
