import * as readline from 'readline';

import { researchDoctor, researchInstitution, lookupNPI, analyzeXProfile, searchNPIProgressive, formatNPIResult, findDoctorSocialMedia } from './medical-core';
import { DoctorQuery, NPIQuery, XProfileQuery, SocialMediaQuery } from './medical-schemas';

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
  console.log("5. Find doctor's social media & websites");
  console.log("6. Exit\n");
}

// Main CLI function
async function runMedicalResearch() {
  try {
    while (true) {
      displayMenu();
      
      let choice = "";
      while (!["1", "2", "3", "4", "5", "6"].includes(choice)) {
        choice = await askQuestion("Enter your choice (1-6): ");
        if (!["1", "2", "3", "4", "5", "6"].includes(choice)) {
          console.log("⚠️ Please enter a valid option (1-6).\n");
        }
      }

      if (choice === "6") {
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
      } else if (choice === "5") {
        // Social media & website finder
        await handleSocialMediaFinder();
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

  console.log("\n🔍 Researching...");

  // Set quiet mode to reduce verbose logging
  process.env.QUIET_MODE = "true";

  const doctorQuery: DoctorQuery = {
    name: name.trim(),
    specialty: specialty.trim(),
    location_hint: locationHint.trim() || undefined,
    institution_hint: institutionHint.trim() || undefined,
  };

  const result = await researchDoctor(doctorQuery);

  // Reset quiet mode
  delete process.env.QUIET_MODE;

  console.log("\n✅ Doctor Found!");
  console.log("================");
  console.log(`👨‍⚕️ ${result.name}`);
  console.log(`🏥 ${result.specialty}`);
  console.log(`📍 ${result.location}`);
  console.log(`🏢 ${result.workplace}`);
  
  if (result.additional_workplaces && result.additional_workplaces.length > 0) {
    console.log(`🏢 Also works at: ${result.additional_workplaces.join(", ")}`);
  }
  
  console.log(`📊 Confidence: ${(result.confidence_score * 100).toFixed(0)}%`);
  
  // Display sources used for transparency
  if (result.sources && result.sources.length > 0) {
    console.log(`\n📚 Sources Used:`);
    result.sources.forEach((source, index) => {
      console.log(`${index + 1}. ${source}`);
    });
  }
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

  console.log("\n🔍 Researching...");
  
  // Temporarily disable quiet mode to see debug output
  // process.env.QUIET_MODE = "true";
  const institutionQuery = { name: institutionName };
  const institutionResult = await researchInstitution(institutionQuery);
  // delete process.env.QUIET_MODE;

  console.log("\n✅ Institution Found!");
  console.log("====================");
  console.log(`🏢 ${institutionResult.name}`);
  console.log(`📍 ${institutionResult.location}`);
  
  if (institutionResult.websites && institutionResult.websites.length > 0) {
    console.log(`🔗 ${institutionResult.websites[0]}`);
  }
  
  console.log(`📊 Confidence: ${(institutionResult.confidence_score * 100).toFixed(0)}%`);
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
    
    // Add "None of these" option
    const maxOption = Math.min(searchResult.results.length, 10);
    console.log(`${maxOption + 1}. None of these - person not found or no NPI\n`);

    // Get user selection
    let selection = "";
    while (!selection || isNaN(parseInt(selection)) || parseInt(selection) < 1 || parseInt(selection) > maxOption + 1) {
      selection = await askQuestion(`\nEnter your choice (1-${maxOption + 1}): `);
      if (!selection || isNaN(parseInt(selection)) || parseInt(selection) < 1 || parseInt(selection) > maxOption + 1) {
        console.log("⚠️ Please enter a valid number from the list above.\n");
      }
    }

    // Check if user selected "None of these"
    if (parseInt(selection) === maxOption + 1) {
      console.log("\n❌ No matching provider found");
      console.log("=================================");
      console.log("The person you're looking for may:");
      console.log("• Not have an NPI number (international doctors, retired, etc.)");
      console.log("• Be listed under a different name or spelling");
      console.log("• Not be in the NPPES registry");
      console.log("• Try using Option 1 (Doctor Profile Research) for broader search\n");
      return;
    }

     selectedResult = searchResult.results[parseInt(selection) - 1];
  }

  // Step 5: Display the selected result directly using correct NPI API field structure
  console.log("\n✅ NPI Found!");
  console.log("==============");
  
  // Extract data from NPI API structure
  const basicInfo = selectedResult.basic || {};
  const addresses = selectedResult.addresses || [];
  const taxonomies = selectedResult.taxonomies || [];
  
  const practiceAddress = addresses.find(addr => addr.address_purpose === "LOCATION") || addresses[0];
  const primaryTaxonomy = taxonomies.find(tax => tax.primary === true) || taxonomies[0];
  
  const credential = basicInfo.credential || "";
  const fullName = `${basicInfo.first_name || ""} ${basicInfo.last_name || ""}`.trim();
  const nameWithCredential = credential ? `${fullName}, ${credential}` : fullName;
  
  const addressLine = practiceAddress ? 
    `${practiceAddress.address_1 || ""} ${practiceAddress.address_2 || ""}`.trim() : "";
  const addressCity = practiceAddress?.city || "";
  const addressState = practiceAddress?.state || "";
  const postal = practiceAddress?.postal_code || "";
  const fullAddress = `${addressLine}, ${addressCity}, ${addressState}, ${postal}`.replace(/^,\s*|,\s*$/, '');
  
  console.log(`🔢 NPI: ${selectedResult.number || "Not available"}`);
  console.log(`👨‍⚕️ ${nameWithCredential || "Not available"}`);
  console.log(`🏥 ${primaryTaxonomy?.desc || "Not specified"}`);
  console.log(`📍 ${fullAddress || "Not available"}`);
  
  if (practiceAddress?.telephone_number) {
    console.log(`📞 ${practiceAddress.telephone_number}`);
  }
  
  console.log(`✅ Status: ${basicInfo.status || "Not available"}`);
  console.log(`📊 Confidence: 100%`); // Direct selection from NPI registry
}

// Handle X profile analysis with user choice for in-depth research
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

  // Set quiet mode to reduce verbose logging
  process.env.QUIET_MODE = "true";

  const xQuery: XProfileQuery = {
    username: username.trim(),
  };

  const analysisResult = await analyzeXProfile(xQuery);

  // Reset quiet mode
  delete process.env.QUIET_MODE;

  // Clean, simple output
  console.log("✅ Profile Analyzed!");
  console.log("===================");
  console.log(`🐦 @${analysisResult.username}`);
  console.log(`🏷️ ${analysisResult.classification.toUpperCase()}`);
  console.log(`📊 ${(analysisResult.confidence_score * 100).toFixed(0)}% confidence`);
  
  if (analysisResult.twitter_id) {
    console.log(`🆔 Twitter ID: ${analysisResult.twitter_id}`);
  }
  
  if (analysisResult.profile_data?.display_name) {
    console.log(`👤 ${analysisResult.profile_data.display_name}`);
  }

  // Ask user if they want in-depth analysis for doctor or institution
  if (analysisResult.classification === "doctor" || analysisResult.classification === "institution") {
    console.log(`\n🔍 Would you like an in-depth ${analysisResult.classification} profile?`);
    const wantInDepth = await askQuestion("Get detailed research? (y/n): ");
    
    if (wantInDepth.toLowerCase().startsWith("y")) {
      if (analysisResult.classification === "doctor") {
        console.log("\n🔄 Researching doctor profile...");
        
        // Extract name for doctor research
        const doctorName = analysisResult.profile_data?.display_name || analysisResult.username;
        const doctorQuery: DoctorQuery = {
          name: doctorName,
        };
        
        // Set quiet mode for doctor research
        process.env.QUIET_MODE = "true";
        
        try {
          const doctorResult = await researchDoctor(doctorQuery);
          
          // Reset quiet mode
          delete process.env.QUIET_MODE;
          
          console.log("\n✅ Doctor Found!");
          console.log("================");
          console.log(`👨‍⚕️ ${doctorResult.name}`);
          console.log(`🏥 ${doctorResult.specialty}`);
          console.log(`📍 ${doctorResult.location}`);
          console.log(`🏢 ${doctorResult.workplace}`);
          
          if (doctorResult.additional_workplaces && doctorResult.additional_workplaces.length > 0) {
            console.log(`🏢 Also works at: ${doctorResult.additional_workplaces.join(", ")}`);
          }
          
          console.log(`📊 Confidence: ${(doctorResult.confidence_score * 100).toFixed(0)}%`);
          
        } catch (error) {
          delete process.env.QUIET_MODE;
          console.log("❌ Error during doctor research");
        }
        
      } else if (analysisResult.classification === "institution") {
        console.log("\n🔄 Researching institution...");
        
        // Extract name for institution research
        const institutionName = analysisResult.profile_data?.display_name || analysisResult.username;
        const institutionQuery = {
          name: institutionName,
        };
        
        // Set quiet mode for institution research
        process.env.QUIET_MODE = "true";
        
        try {
          const institutionResult = await researchInstitution(institutionQuery);
          
          // Reset quiet mode
          delete process.env.QUIET_MODE;
          
          console.log("\n✅ Institution Found!");
          console.log("====================");
          console.log(`🏢 ${institutionResult.name}`);
          console.log(`📍 ${institutionResult.location}`);
          
          if (institutionResult.websites && institutionResult.websites.length > 0) {
            console.log(`🔗 ${institutionResult.websites[0]}`);
          }
          
          console.log(`📊 Confidence: ${(institutionResult.confidence_score * 100).toFixed(0)}%`);
          
        } catch (error) {
          delete process.env.QUIET_MODE;
          console.log("❌ Error during institution research");
        }
      }
    } else {
      console.log("\n✅ Classification complete.");
    }
  } else if (analysisResult.classification === "neither") {
    console.log("\n❌ Not Medical-Related");
    console.log("======================");
    console.log("This account does not appear to be medically related.");
  }
}

// Handle social media & website finder
async function handleSocialMediaFinder() {
  console.log("\n🔗 Social Media & Website Finder");
  console.log("=================================\n");

  let name = "";
  while (!name.trim()) {
    name = await askQuestion("Enter the doctor's full name: ");
    if (!name.trim()) {
      console.log("⚠️ Please enter a doctor's name to continue.\n");
    }
  }

  const specialty = await askQuestion("Enter medical specialty (optional, press Enter to skip): ");
  const institution = await askQuestion("Enter institution/workplace (optional, press Enter to skip): ");
  const xUsername = await askQuestion("Enter X/Twitter username if known (optional, press Enter to skip): ");

  const query: SocialMediaQuery = {
    name: name.trim(),
    specialty: specialty.trim() || undefined,
    institution: institution.trim() || undefined,
    x_username: xUsername.trim() || undefined,
  };

  console.log("\n🔍 Searching for social media profiles and websites...");

  try {
    const result = await findDoctorSocialMedia(query);

    console.log("\n✅ Social Media & Websites Found!");
    console.log("==================================");
    console.log(`👤 ${result.doctor_name}`);
    console.log(`🏥 ${result.specialty}`);
    console.log(`📊 Overall Confidence: ${(result.confidence_score * 100).toFixed(0)}%`);
    console.log(`🔗 Total Found: ${result.total_found} profiles/websites\n`);

    if (result.results.length === 0) {
      console.log("❌ No social media profiles or websites found.");
      console.log("Try searching with different name variations or adding specialty/institution information.");
    } else {
      // Group results by platform type
      const groupedResults = result.results.reduce((groups, item) => {
        const platform = item.platform;
        if (!groups[platform]) groups[platform] = [];
        groups[platform].push(item);
        return groups;
      }, {} as Record<string, typeof result.results>);

      // Display results by platform type
      const platformEmojis = {
        linkedin: "💼",
        personal_website: "🌐",
        faculty_page: "🏫",
        research_profile: "🔬",
        practice_website: "🏥",
        other: "🔗"
      };

      const platformNames = {
        linkedin: "LinkedIn",
        personal_website: "Personal Website",
        faculty_page: "Faculty Page",
        research_profile: "Research Profile",
        practice_website: "Practice Website",
        other: "Other"
      };

      for (const [platform, items] of Object.entries(groupedResults)) {
        const emoji = platformEmojis[platform as keyof typeof platformEmojis] || "🔗";
        const name = platformNames[platform as keyof typeof platformNames] || "Other";
        
        console.log(`${emoji} ${name}:`);
        for (const item of items) {
          console.log(`   ${item.url}`);
          console.log(`   📝 ${item.title}`);
          console.log(`   📊 ${(item.verification_score * 100).toFixed(0)}% confidence`);
          if (item.verification_factors.length > 0) {
            console.log(`   ✅ ${item.verification_factors.join(", ")}`);
          }
          console.log("");
        }
      }
    }

  } catch (error) {
    console.error("❌ Error during social media search:", error);
    console.error("Details:", error instanceof Error ? error.message : String(error));
  }
}

// Start the application
runMedicalResearch().catch(console.error);

