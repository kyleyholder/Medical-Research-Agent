import * as readline from 'readline';

import { researchDoctor, researchInstitution, lookupNPI } from './medical-core';
import { DoctorQuery, NPIQuery } from './medical-schemas';

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
  console.log("4. Exit\n");
}

// Main CLI function
async function runMedicalResearch() {
  try {
    while (true) {
      displayMenu();
      
      let choice = "";
      while (!["1", "2", "3", "4"].includes(choice)) {
        choice = await askQuestion("Enter your choice (1-4): ");
        if (!["1", "2", "3", "4"].includes(choice)) {
          console.log("⚠️ Please enter a valid option (1-4).\n");
        }
      }

      if (choice === "4") {
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

// Handle NPI lookup
async function handleNPILookup() {
  console.log("\n🔢 NPI Number Lookup");
  console.log("=====================\n");

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

  const state = await askQuestion("Enter state abbreviation (optional, e.g., 'CA', 'NY'): ");
  const city = await askQuestion("Enter city (optional): ");
  const specialty = await askQuestion("Enter specialty (optional): ");

  console.log("\n🔍 Looking up NPI information...\n");

  const npiQuery: NPIQuery = {
    first_name: firstName.trim(),
    last_name: lastName.trim(),
    state: state.trim() || undefined,
    city: city.trim() || undefined,
    specialty: specialty.trim() || undefined,
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

