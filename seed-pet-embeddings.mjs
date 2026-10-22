
import dotenv from 'dotenv';
import pg from 'pg';
import { pipeline } from '@xenova/transformers';

dotenv.config({ path: '.env.local' });

const { DATABASE_URL } = process.env;
if (!DATABASE_URL) throw new Error('DATABASE_URL missing in .env.local');

const pool = new pg.Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const MODEL = 'Xenova/all-MiniLM-L6-v2';

try {
  console.log('Loading MiniLM model...');
  const embed = await pipeline('feature-extraction', MODEL, {
    quantized: true,
  });

  const { rows: pets } = await pool.query(`
    SELECT id, name, species, breed, age_months, size,
           temperament, description, good_with_kids,
           good_with_pets, apartment_friendly, house_trained,
           energy_level, special_needs
    FROM pets
    ORDER BY id
  `);

  console.log(`Found ${pets.length} pets.`);

  for (const pet of pets) {
    const sourceText = [
      `Name: ${pet.name ?? 'Unknown'}`,
      `Species: ${pet.species ?? 'Unknown'}`,
      `Breed: ${pet.breed ?? 'Unknown'}`,
      `Age: ${pet.age_months ?? 'Unknown'} months`,
      `Size: ${pet.size ?? 'Unknown'}`,
      `Temperament: ${pet.temperament ?? 'Unknown'}`,
      `Description: ${pet.description ?? 'Unknown'}`,
      `Good with kids: ${pet.good_with_kids ?? 'Unknown'}`,
      `Good with pets: ${pet.good_with_pets ?? 'Unknown'}`,
      `Apartment friendly: ${pet.apartment_friendly ?? 'Unknown'}`,
      `House trained: ${pet.house_trained ?? 'Unknown'}`,
      `Energy level: ${pet.energy_level ?? 'Unknown'}`,
      `Special needs: ${pet.special_needs ?? 'None specified'}`,
    ].join('. ').slice(0, 4000);

    const result = await embed(sourceText, {
      pooling: 'mean',
      normalize: true,
    });

    const vector = Array.from(result.data);

    if (vector.length !== 384) {
      throw new Error(`Pet ${pet.id}: expected 384 dimensions, got ${vector.length}`);
    }

    await pool.query(`
      INSERT INTO pet_embeddings
        (pet_id, embedding, source_text, model_name, updated_at)
      VALUES ($1, $2::vector, $3, $4, NOW())
      ON CONFLICT (pet_id) DO UPDATE SET
        embedding = EXCLUDED.embedding,
        source_text = EXCLUDED.source_text,
        model_name = EXCLUDED.model_name,
        updated_at = NOW()
    `, [pet.id, `[${vector.join(',')}]`, sourceText, MODEL]);

    console.log(`Processed ${pet.name} (ID ${pet.id})`);
  }

  console.log(`Done! Processed ${pets.length} pets.`);
} catch (error) {
  console.error('Embedding generation failed:', error.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
