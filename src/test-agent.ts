import { researchDoctor } from './medical-research';
import { DoctorQuery } from './medical-schemas';

async function testMedicalAgent() {
  console.log('🧪 Testing Medical Research Agent');
  console.log('==================================\n');

  // Test cases with different types of doctors
  const testCases: DoctorQuery[] = [
    {
      name: "Dr. Anthony Fauci",
      specialty: "Infectious Disease",
      location_hint: "Washington DC",
      institution_hint: "NIH"
    },
    {
      name: "Dr. Sanjay Gupta",
      specialty: "Neurosurgery",
      location_hint: "Atlanta",
    },
    {
      name: "Dr. Mehmet Oz",
      specialty: "Cardiothoracic Surgery",
    },
    {
      name: "Dr. Paul Farmer",
      specialty: "Internal Medicine",
      location_hint: "Boston",
      institution_hint: "Harvard"
    }
  ];

  for (let i = 0; i < testCases.length; i++) {
    const testCase = testCases[i];
    console.log(`\n📋 Test Case ${i + 1}: ${testCase.name}`);
    console.log('='.repeat(50));
    console.log(`Specialty: ${testCase.specialty}`);
    if (testCase.location_hint) console.log(`Location Hint: ${testCase.location_hint}`);
    if (testCase.institution_hint) console.log(`Institution Hint: ${testCase.institution_hint}`);
    
    try {
      console.log('\n🔍 Starting research...');
      const startTime = Date.now();
      
      const result = await researchDoctor(testCase);
      
      const endTime = Date.now();
      const duration = ((endTime - startTime) / 1000).toFixed(1);
      
      console.log(`\n✅ Research completed in ${duration}s`);
      console.log('\n📊 Results:');
      console.log(`Name: ${result.name}`);
      console.log(`Specialty: ${result.specialty}`);
      console.log(`Location: ${result.location}`);
      console.log(`Workplace: ${result.workplace}`);
      
      if (result.additional_workplaces && result.additional_workplaces.length > 0) {
        console.log(`Additional Workplaces: ${result.additional_workplaces.join(', ')}`);
      }
      
      console.log(`Confidence Score: ${(result.confidence_score * 100).toFixed(1)}%`);
      console.log(`Sources Found: ${result.sources.length}`);
      
      // Show first few sources
      console.log('\n🔗 Top Sources:');
      result.sources.slice(0, 3).forEach((source, idx) => {
        console.log(`   ${idx + 1}. ${source}`);
      });
      
      // Validation checks
      console.log('\n🔍 Validation:');
      if (result.confidence_score >= 0.7) {
        console.log('   ✅ High confidence result');
      } else if (result.confidence_score >= 0.5) {
        console.log('   ⚠️  Medium confidence result');
      } else {
        console.log('   ❌ Low confidence result - may need refinement');
      }
      
      if (result.sources.length >= 3) {
        console.log('   ✅ Multiple sources found');
      } else {
        console.log('   ⚠️  Limited sources found');
      }
      
      // Check for complete information
      const hasCompleteInfo = result.name !== testCase.name && 
                             result.location !== "Location not found" && 
                             result.workplace !== "Workplace not found";
      
      if (hasCompleteInfo) {
        console.log('   ✅ Complete information extracted');
      } else {
        console.log('   ⚠️  Some information missing or not found');
      }
      
    } catch (error) {
      console.log(`\n❌ Test failed for ${testCase.name}`);
      console.error('Error:', error);
    }
    
    console.log('\n' + '='.repeat(70));
  }
  
  console.log('\n🏁 Testing completed!');
}

// Run tests if this file is executed directly
if (require.main === module) {
  testMedicalAgent().catch(console.error);
}

export { testMedicalAgent };

