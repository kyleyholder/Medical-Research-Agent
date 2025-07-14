import * as readline from 'readline';

import { researchDoctor, researchInstitution, lookupNPI, analyzeXProfile, searchNPIProgressive, formatNPIResult } from './medical-core';
import { DoctorQuery, NPIQuery, XProfileQuery } from './medical-schemas';

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

// Display main menu
function displayMenu() {
  console.log("🏥 Medical Research Agent");
  console.log("==========================");
  console.log("This tool helps you find information about medical professionals and institutions.\n");
  console.log("Please select an option:");
  console.log("1. Research full doctor profile");
  console.log("2. Find medical institution location");
  console.log("3. Find NPI number for US doctor");
  console.log("4. Analyze X/Twitter profile");
  console.log("5. Exit\n");
}

// Main CLI function
async function runMedicalResearch() {
  try {
    while (true) {
      displayMenu();
      
      let choice = "";
      while (!["1", "2", "3", "4", "5"].includes(choice)) {
        choice = await askQuestion("Enter your choice (1-5): ");
        if (!["1", "2", "3", "4", "5"].includes(choice)) {
          console.log("⚠️ Please enter a valid option (1-5).\n");
        }
      }

      if (choice === "5") {
        console.log("\n👋 Thank you for using the Medical Research Agent!");
        break;
      }

      if (choice === "1") {
        // Doctor profile research
        await handleDoctorResearch();
      } else if (choice === "2") {
        // Institution location research
        await handleInstitutionResearch();
      } else if (choice === "3") {
        // NPI lookup
        await handleNPILookup();
      } else if (choice === "4") {
        // X profile analysis
        await handleXProfileAnalysis();
      }

      // Ask if user wants to continue
      console.log("\n" + "=".repeat(50));
      const continueChoice = await askQuestion("Would you like to perform another search? (y/n): ");
      if (continueChoice.toLowerCase() !== "y" && continueChoice.toLowerCase() !== "yes") {
        console.log("\n👋 Thank you for using the Medical Research Agent!");
        break;
      }
      console.log("\n");
    }
  } catch (error) {
    console.error("❌ Error during research:", error);
    console.error("Details:", error instanceof Error ? error.message : String(error));
  } finally {
    rl.close();
  }
}

// Handle doctor profile research
async function handleDoctorResearch() {
  console.log("\n🔍 Doctor Profile Research");
  console.log("===========================\n");

  let name = "";
  while (!name.trim()) {
    name = await askQuestion("Enter the doctor's name: ");
    if (!name.trim()) {
      console.log("⚠️ Please enter a doctor's name to continue.\n");
    }
  }

  let specialty = "";
  while (!specialty.trim()) {
    specialty = await askQuestion("Enter the doctor's medical specialty: ");
    if (!specialty.trim()) {
      console.log("⚠️ Please enter a medical specialty to continue.\n");
    }
  }

  const locationHint = await askQuestion("Enter a location hint (optional, press Enter to skip): ");
  const institutionHint = await askQuestion("Enter an institution hint (optional, press Enter to skip): ");

  console.log("\n🔍 Starting comprehensive research...\n");

  const doctorQuery: DoctorQuery = {
    name: name.trim(),
    specialty: specialty.trim(),
    location_hint: locationHint.trim() || undefined,
    institution_hint: institutionHint.trim() || undefined,
  };

  const result = await researchDoctor(doctorQuery);

  console.log("\n✅ Research Complete!");
  console.log("====================");
  console.log("\n📊 Summary:");
  console.log(`👨‍⚕️ Doctor: ${result.name}`);
  console.log(`🏥 Specialty: ${result.specialty}`);
  console.log(`📍 Location: ${result.location}`);
  console.log(`🏢 Workplace: ${result.workplace}`);
  if (result.additional_workplaces && result.additional_workplaces.length > 0) {
    console.log(`🏢 Additional Workplaces: ${result.additional_workplaces.join(", ")}`);
  }
  if (result.additional_locations && result.additional_locations.length > 0) {
    console.log(`📍 Additional Locations: ${result.additional_locations.join(", ")}`);
  }
  console.log(`📊 Confidence Score: ${(result.confidence_score * 100).toFixed(1)}%`);
  console.log(`🔗 Sources Found: ${result.sources.length}`);

  if (result.sources.length > 5) {
    console.log(`   📄 First 5 sources: ${result.sources.slice(0, 5).join(", ")}`);
    console.log(`   ... and ${result.sources.length - 5} more sources`);
  }

  console.log("\n📄 Full JSON Output:");
  console.log("=".repeat(50));
  console.log(JSON.stringify(result, null, 2));
}

// Handle institution research
async function handleInstitutionResearch() {
  console.log("\n🏥 Institution Location Research");
  console.log("=================================\n");

  let institutionName = "";
  while (!institutionName.trim()) {
    institutionName = await askQuestion("Enter the institution's name: ");
    if (!institutionName.trim()) {
      console.log("⚠️ Please enter an institution's name to continue.\n");
    }
  }

  console.log("\n🔍 Starting research for institution...\n");
  const institutionQuery = { name: institutionName };
  const institutionResult = await researchInstitution(institutionQuery);

  console.log("\n✅ Research Complete!");
  console.log("====================");
  console.log("\n📊 Summary:");
  console.log(`🏢 Institution Name: ${institutionResult.name}`);
  console.log(`📍 Location: ${institutionResult.location}`);
  if (institutionResult.websites && institutionResult.websites.length > 0) {
    console.log(`🔗 Websites: ${institutionResult.websites.join(", ")}`);
  }
  if (institutionResult.social_media && institutionResult.social_media.length > 0) {
    console.log(`📱 Social Media: ${institutionResult.social_media.join(", ")}`);
  }
  console.log(`📊 Confidence Score: ${(institutionResult.confidence_score * 100).toFixed(1)}%`);
  if (institutionResult.sources && institutionResult.sources.length > 0) {
    console.log(`🔗 Sources Found: ${institutionResult.sources.length}`);
  }
  console.log("\n📄 Full JSON Output:");
  console.log("=".repeat(50));
  console.log(JSON.stringify(institutionResult, null, 2));
}

// Handle progressive NPI lookup
async function handleNPILookup() {
  console.log("\n🔢 NPI Number Lookup");
  console.log("=====================\n");

  // Step 1: Get first and last name (required)
  let firstName = "";
  while (!firstName.trim()) {
    firstName = await askQuestion("Enter the doctor's first name: ");
    if (!firstName.trim()) {
      console.log("⚠️ Please enter a first name to continue.\n");
    }
  }

  let lastName = "";
  while (!lastName.trim()) {
    lastName = await askQuestion("Enter the doctor's last name: ");
    if (!lastName.trim()) {
      console.log("⚠️ Please enter a last name to continue.\n");
    }
  }

  console.log("\n🔍 Searching NPI registry...\n");

  // Step 2: Initial search with name only
  let searchResult = await searchNPIProgressive(firstName.trim(), lastName.trim());
  
  if (searchResult.total_count === 0) {
    console.log("❌ No providers found with that name.");
    console.log("💡 Try checking the spelling or using a different name format.\n");
    return;
  }

  console.log(`📊 Found ${searchResult.total_count} provider(s) with the name "${firstName} ${lastName}"`);

  // Step 3: If multiple results, progressively filter
  let state: string | undefined;
  let city: string | undefined;
  let specialty: string | undefined;

  // Filter by state if too many results
  if (searchResult.results.length > 10) {
    console.log("\n🌍 Too many results found. Let's narrow it down...");
    state = await askQuestion("Enter state abbreviation (e.g., 'CA', 'NY') or press Enter to skip: ");
    
    if (state && state.trim()) {
      console.log(`\n🔍 Filtering by state: ${state.toUpperCase()}...\n`);
      searchResult = await searchNPIProgressive(firstName.trim(), lastName.trim(), state.trim());
      console.log(`📊 Found ${searchResult.total_count} provider(s) in ${state.toUpperCase()}`);
    }
  }

  // Filter by city if still too many results
  if (searchResult.results.length > 5) {
    console.log("\n🏙️ Still multiple results. Let's narrow it down further...");
    city = await askQuestion("Enter city or press Enter to skip: ");
    
    if (city && city.trim()) {
      console.log(`\n🔍 Filtering by city: ${city}...\n`);
      searchResult = await searchNPIProgressive(firstName.trim(), lastName.trim(), state, city.trim());
      console.log(`📊 Found ${searchResult.total_count} provider(s) in ${city}`);
    }
  }

  // Filter by specialty if still too many results
  if (searchResult.results.length > 3) {
    console.log("\n🩺 Still multiple results. Let's filter by specialty...");
    specialty = await askQuestion("Enter specialty (e.g., 'Internal Medicine', 'Cardiology') or press Enter to skip: ");
    
    if (specialty && specialty.trim()) {
      console.log(`\n🔍 Filtering by specialty: ${specialty}...\n`);
      searchResult = await searchNPIProgressive(firstName.trim(), lastName.trim(), state, city, specialty.trim());
      console.log(`📊 Found ${searchResult.total_count} provider(s) with specialty "${specialty}"`);
    }
  }

  // Step 4: Handle results
  if (searchResult.results.length === 0) {
    console.log("❌ No providers found with the specified criteria.");
    console.log("💡 Try using broader search terms or check the spelling.\n");
    return;
  }

  let selectedResult;

  if (searchResult.results.length === 1) {
    // Only one result, use it
    selectedResult = searchResult.results[0];
    console.log("✅ Found exactly one provider matching your criteria!\n");
  } else {
    // Multiple results, let user choose
    console.log(`\n📋 Found ${searchResult.results.length} providers. Please select one:\n`);
    
    // Display options
    for (let i = 0; i < Math.min(searchResult.results.length, 10); i++) {
      console.log(formatNPIResult(searchResult.results[i], i));
    }
    
    if (searchResult.results.length > 10) {
      console.log(`\n... and ${searchResult.results.length - 10} more results`);
    }

    // Get user selection
    let selection = "";
    while (!selection || isNaN(parseInt(selection)) || parseInt(selection) < 1 || parseInt(selection) > Math.min(searchResult.results.length, 10)) {
      selection = await askQuestion(`\nEnter your choice (1-${Math.min(searchResult.results.length, 10)}): `);
      if (!selection || isNaN(parseInt(selection)) || parseInt(selection) < 1 || parseInt(selection) > Math.min(searchResult.results.length, 10)) {
        console.log("⚠️ Please enter a valid number from the list above.\n");
      }
    }

    selectedResult = searchResult.results[parseInt(selection) - 1];
  }

  // Step 5: Convert selected result to NPIInfo format and display
  const npiQuery: NPIQuery = {
    first_name: firstName.trim(),
    last_name: lastName.trim(),
    state: state?.trim(),
    city: city?.trim(),
    specialty: specialty?.trim(),
  };

  const npiResult = await lookupNPI(npiQuery);

  console.log("\n✅ NPI Lookup Complete!");
  console.log("========================");
  console.log("\n📊 Summary:");
  console.log(`🔢 NPI Number: ${npiResult.npi_number}`);
  console.log(`👨‍⚕️ Name: ${npiResult.name}`);
  console.log(`🏥 Specialty: ${npiResult.specialty}`);
  console.log(`📍 Practice Address: ${npiResult.practice_address}`);
  if (npiResult.mailing_address) {
    console.log(`📮 Mailing Address: ${npiResult.mailing_address}`);
  }
  if (npiResult.phone) {
    console.log(`📞 Phone: ${npiResult.phone}`);
  }
  console.log(`📅 Enumeration Date: ${npiResult.enumeration_date}`);
  console.log(`🔄 Last Updated: ${npiResult.last_updated}`);
  console.log(`✅ Status: ${npiResult.status}`);
  console.log(`🏷️ Entity Type: ${npiResult.entity_type}`);
  console.log(`📊 Confidence Score: ${(npiResult.confidence_score * 100).toFixed(1)}%`);

  console.log("\n📄 Full JSON Output:");
  console.log("=".repeat(50));
  console.log(JSON.stringify(npiResult, null, 2));
}

// Start the application
runMedicalResearch().catch(console.error);


// Handle X profile analysis
async function handleXProfileAnalysis() {
  console.log("\n🐦 X/Twitter Profile Analysis");
  console.log("==============================\n");

  let username = "";
  while (!username.trim()) {
    username = await askQuestion("Enter X username (with or without @): ");
    if (!username.trim()) {
      console.log("⚠️ Please enter an X username to continue.\n");
    }
  }

  console.log("\n🔍 Analyzing X profile...\n");

  const xQuery: XProfileQuery = {
    username: username.trim(),
  };

  const analysisResult = await analyzeXProfile(xQuery);

  console.log("\n✅ X Profile Analysis Complete!");
  console.log("===============================");
  console.log("\n📊 Classification Summary:");
  console.log(`🐦 Username: @${analysisResult.username}`);
  console.log(`🔗 Profile URL: ${analysisResult.profile_url}`);
  console.log(`🏷️ Classification: ${analysisResult.classification.toUpperCase()}`);
  console.log(`📊 Confidence Score: ${(analysisResult.confidence_score * 100).toFixed(1)}%`);
  console.log(`💭 Reasoning: ${analysisResult.reasoning}`);

  if (analysisResult.profile_data) {
    console.log("\n📋 Profile Data:");
    if (analysisResult.profile_data.display_name) {
      console.log(`👤 Display Name: ${analysisResult.profile_data.display_name}`);
    }
    if (analysisResult.profile_data.bio) {
      console.log(`📝 Bio: ${analysisResult.profile_data.bio}`);
    }
  }

  // Display additional research results based on classification
  if (analysisResult.classification === "doctor" && analysisResult.doctor_info) {
    console.log("\n👨‍⚕️ Doctor Research Results:");
    console.log("============================");
    console.log(`👨‍⚕️ Name: ${analysisResult.doctor_info.name}`);
    console.log(`🏥 Specialty: ${analysisResult.doctor_info.specialty}`);
    console.log(`📍 Location: ${analysisResult.doctor_info.location}`);
    console.log(`🏢 Workplace: ${analysisResult.doctor_info.workplace}`);
    if (analysisResult.doctor_info.additional_workplaces && analysisResult.doctor_info.additional_workplaces.length > 0) {
      console.log(`🏢 Additional Workplaces: ${analysisResult.doctor_info.additional_workplaces.join(", ")}`);
    }
    console.log(`📊 Research Confidence: ${(analysisResult.doctor_info.confidence_score * 100).toFixed(1)}%`);
    console.log(`🔗 Sources: ${analysisResult.doctor_info.sources?.length || 0} found`);
  } else if (analysisResult.classification === "institution" && analysisResult.institution_info) {
    console.log("\n🏥 Institution Research Results:");
    console.log("===============================");
    console.log(`🏢 Name: ${analysisResult.institution_info.name}`);
    console.log(`📍 Location: ${analysisResult.institution_info.location}`);
    if (analysisResult.institution_info.websites && analysisResult.institution_info.websites.length > 0) {
      console.log(`🔗 Websites: ${analysisResult.institution_info.websites.join(", ")}`);
    }
    if (analysisResult.institution_info.social_media && analysisResult.institution_info.social_media.length > 0) {
      console.log(`📱 Social Media: ${analysisResult.institution_info.social_media.join(", ")}`);
    }
    console.log(`📊 Research Confidence: ${(analysisResult.institution_info.confidence_score * 100).toFixed(1)}%`);
    if (analysisResult.institution_info.sources) {
      console.log(`🔗 Sources: ${analysisResult.institution_info.sources.length} found`);
    }
  } else if (analysisResult.classification === "neither") {
    console.log("\n❌ Not Medical-Related");
    console.log("======================");
    console.log("This X profile does not appear to be associated with a medical professional or institution.");
    console.log("This is useful for Medical Watch verification - the account may not be medically relevant.");
  }

  console.log("\n📄 Full JSON Output:");
  console.log("=".repeat(50));
  console.log(JSON.stringify(analysisResult, null, 2));
}

