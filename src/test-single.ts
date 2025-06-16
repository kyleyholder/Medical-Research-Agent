import { researchDoctor } from './medical-research';
import { DoctorQuery } from './medical-schemas';

async function testSingleDoctor() {
  console.log('🧪 Single Doctor Test - Medical Research Agent');
  console.log('==============================================\n');

  // Test with a well-known doctor to validate functionality
  const testCase: DoctorQuery = {
    name: "Dr. Atul Gawande",
    specialty: "Surgery",
    location_hint: "Boston",
    institution_hint: "Harvard"
  };

  console.log(`📋 Testing: ${testCase.name}`);
  console.log(`Specialty: ${testCase.specialty}`);
  console.log(`Location Hint: ${testCase.location_hint}`);
  console.log(`Institution Hint: ${testCase.institution_hint}`);
  
  try {
    console.log('\n🔍 Starting research...');
    const startTime = Date.now();
    
    const result = await researchDoctor(testCase);
    
    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(1);
    
    console.log(`\n✅ Research completed in ${duration}s`);
    console.log('\n📊 Results:');
    console.log('='.repeat(50));
    
    // Display results in a formatted way
    console.log(`👨‍⚕️ Name: ${result.name}`);
    console.log(`🏥 Specialty: ${result.specialty}`);
    console.log(`📍 Location: ${result.location}`);
    console.log(`🏢 Workplace: ${result.workplace}`);
    
    if (result.additional_workplaces && result.additional_workplaces.length > 0) {
      console.log(`🏢 Additional Workplaces: ${result.additional_workplaces.join(', ')}`);
    }
    
    console.log(`📊 Confidence Score: ${(result.confidence_score * 100).toFixed(1)}%`);
    console.log(`🔗 Sources Found: ${result.sources.length}`);
    console.log(`⏰ Last Updated: ${result.last_updated}`);
    
    // Show sources
    console.log('\n🔗 Sources:');
    result.sources.forEach((source, idx) => {
      console.log(`   ${idx + 1}. ${source}`);
    });
    
    // JSON output
    console.log('\n📄 JSON Output:');
    console.log('='.repeat(50));
    console.log(JSON.stringify(result, null, 2));
    
    // Validation
    console.log('\n🔍 Validation:');
    console.log('='.repeat(50));
    
    if (result.confidence_score >= 0.7) {
      console.log('✅ High confidence result');
    } else if (result.confidence_score >= 0.5) {
      console.log('⚠️  Medium confidence result');
    } else {
      console.log('❌ Low confidence result');
    }
    
    if (result.sources.length >= 3) {
      console.log('✅ Multiple sources found');
    } else {
      console.log('⚠️  Limited sources found');
    }
    
    const hasCompleteInfo = result.location !== "Information not found" && 
                           result.workplace !== "Information not found";
    
    if (hasCompleteInfo) {
      console.log('✅ Complete information extracted');
    } else {
      console.log('⚠️  Some information missing');
    }
    
    console.log('\n🎉 Test completed successfully!');
    
  } catch (error) {
    console.log(`\n❌ Test failed for ${testCase.name}`);
    console.error('Error:', error);
  }
}

// Run test if this file is executed directly
if (require.main === module) {
  testSingleDoctor().catch(console.error);
}

export { testSingleDoctor };

