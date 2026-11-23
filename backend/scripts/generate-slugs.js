const { prisma } = require('../shared/data/prisma');

function generateSlug(name) {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

async function generateSlugs() {
  console.log('Generating slugs for existing courts...');
  
  const courts = await prisma.court.findMany({
    where: { slug: null }
  });

  console.log(`Found ${courts.length} courts without slugs`);

  for (const court of courts) {
    const slug = generateSlug(court.name);
    
    // Ensure slug is unique by adding a number if needed
    let uniqueSlug = slug;
    let counter = 1;
    
    while (true) {
      const existing = await prisma.court.findFirst({
        where: { slug: uniqueSlug }
      });
      
      if (!existing || existing.id === court.id) {
        break;
      }
      
      uniqueSlug = `${slug}-${counter}`;
      counter++;
    }
    
    await prisma.court.update({
      where: { id: court.id },
      data: { slug: uniqueSlug }
    });
    
    console.log(`Updated court "${court.name}" with slug: ${uniqueSlug}`);
  }

  console.log('Slug generation completed!');
}

generateSlugs()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
