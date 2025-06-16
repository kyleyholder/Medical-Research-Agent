import * as readline from 'readline';

import { researchDoctor } from './medical-core';
import { DoctorQuery } from './medical-schemas';

// Helper function for consistent logging
function log(...args: any[]) {
  console.log(...args);
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

// Helper function to get user input
function askQuestion(query: string): Promise<string> {
  return new Promise(resolve => {
    rl.question(query, answer => {
      resolve(answer);
    });
  });
}

// Main CLI function
async function runMedicalResearch() {
  console.log('🏥 Medical Research Agent');
  console.log('==========================');
  console.log('This tool helps you find information about medical professionals.\n');

  try {
    // Get doctor information from user with retry logic
    let name = '';
    while (!name.trim()) {
      name = await askQuestion('Enter the doctor\'s name: ');
      if (!name.trim()) {
        console.log('⚠️  Please enter a doctor\'s name to continue.\n');
      }
    }

    let specialty = '';
    while (!specialty.trim()) {
      specialty = await askQuestion('Enter the medical specialty: ');
      if (!specialty.trim()) {
        console.log('⚠️  Please enter a medical specialty to continue.\n');
      }
    }

    const location_hint = await askQuestion('Enter location hint (optional, press Enter to skip): ');
    const institution_hint = await askQuestion('Enter institution hint (optional, press Enter to skip): ');

    // Create the query object
    const doctorQuery: DoctorQuery = {
      name: name.trim(),
      specialty: specialty.trim(),
      location_hint: location_hint.trim() || undefined,
      institution_hint: institution_hint.trim() || undefined,
    };

    console.log('\n🔍 Starting research...\n');

    // Perform the research
    const result = await researchDoctor(doctorQuery);

    // Display results
    console.log('\n✅ Research Complete!');
    console.log('====================');
    
    console.log('\n📊 Summary:');
    console.log(`👨‍⚕️ Name: ${result.name}`);
    console.log(`🏥 Specialty: ${result.specialty}`);
    console.log(`📍 Location: ${result.location}`);
    console.log(`🏢 Workplace: ${result.workplace}`);
    if (result.additional_workplaces && result.additional_workplaces.length > 0) {
      console.log(`🏢 Additional Workplaces: ${result.additional_workplaces.join(', ')}`);
    }
    console.log(`📊 Confidence Score: ${(result.confidence_score * 100).toFixed(1)}%`);
    console.log(`🔗 Sources Found: ${result.sources.length}`);

    if (result.confidence_score < 0.5) {
      console.log('\n⚠️  Low confidence score. Consider:');
      console.log('   - Checking the spelling of the name');
      console.log('   - Providing more specific specialty information');
      console.log('   - Adding location or institution hints');
    }

    console.log('\n🔗 Top Sources:');
    result.sources.slice(0, 5).forEach((source, index) => {
      console.log(`   ${index + 1}. ${source}`);
    });
    if (result.sources.length > 5) {
      console.log(`   ... and ${result.sources.length - 5} more sources`);
    }

    console.log('\n📄 Full JSON Output:');
    console.log('='.repeat(50));
    console.log(JSON.stringify(result, null, 2));

    // Ask if user wants to research another doctor
    console.log('\n' + '='.repeat(50));
    const another = await askQuestion('Would you like to research another doctor? (y/n): ');
    if (another.toLowerCase().startsWith('y')) {
      console.log('\n');
      await runMedicalResearch(); // Recursive call for another search
    } else {
      console.log('\n👋 Thank you for using the Medical Research Agent!');
    }

  } catch (error) {
    console.error('\n❌ Error during research:', error);
    if (error instanceof Error) {
      console.error('Details:', error.message);
    }
    
    // Ask if user wants to try again
    const retry = await askQuestion('\nWould you like to try again? (y/n): ');
    if (retry.toLowerCase().startsWith('y')) {
      console.log('\n');
      await runMedicalResearch();
    }
  } finally {
    rl.close();
  }
}

// Run the CLI if this file is executed directly
if (require.main === module) {
  runMedicalResearch().catch(console.error);
}

export { runMedicalResearch };

