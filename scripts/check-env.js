// Simple script to check if required environment variables are set
// This doesn't expose values, only checks if they exist

const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '../.env.local');

if (!fs.existsSync(envPath)) {
  console.error('❌ .env.local file not found!');
  process.exit(1);
}

const envContent = fs.readFileSync(envPath, 'utf-8');
const envLines = envContent.split('\n');

// Required variables
const required = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SMTP_HOST',
  'SMTP_PORT',
  'SMTP_USER',
  'SMTP_PASSWORD',
  'SMTP_FROM',
];

// Optional but recommended
const recommended = [
  'SUPABASE_SERVICE_ROLE_KEY',
  'NEXT_PUBLIC_SITE_URL',
  'NEXT_PUBLIC_BASE_URL',
  'REVALIDATION_SECRET',
  'SMTP_FROM_NAME',
];

const found = {};
const missing = [];
const issues = [];

// Parse env file
envLines.forEach(line => {
  line = line.trim();
  if (line && !line.startsWith('#') && line.includes('=')) {
    const [key] = line.split('=');
    found[key.trim()] = true;
  }
});

console.log('\n🔍 Checking .env.local file...\n');

// Check required
console.log('📋 REQUIRED VARIABLES:');
required.forEach(key => {
  if (found[key]) {
    console.log(`✅ ${key}`);
  } else {
    console.log(`❌ ${key} - MISSING!`);
    missing.push(key);
  }
});

// Check recommended
console.log('\n💡 RECOMMENDED VARIABLES:');
recommended.forEach(key => {
  if (found[key]) {
    console.log(`✅ ${key}`);
  } else {
    console.log(`⚠️  ${key} - Not set (optional but recommended)`);
  }
});

// Validate SMTP_PORT if set
if (found.SMTP_PORT) {
  const portLine = envLines.find(line => line.trim().startsWith('SMTP_PORT='));
  if (portLine) {
    const port = portLine.split('=')[1]?.trim();
    if (port === '465' || port === '587') {
      console.log('\n✅ SMTP_PORT is valid (465 or 587)');
    } else {
      issues.push('SMTP_PORT should be 465 or 587');
    }
  }
}

// Check for common issues
envLines.forEach((line, index) => {
  const trimmed = line.trim();
  if (trimmed && !trimmed.startsWith('#')) {
    // Check for values with quotes (sometimes problematic)
    if (trimmed.includes('=') && (trimmed.includes('"') || trimmed.includes("'"))) {
      const [key, value] = trimmed.split('=');
      if (value && value.match(/^["'].*["']$/)) {
        // It's okay to have quotes, but warn if it might cause issues
        if (key.trim().includes('PASSWORD') || key.trim().includes('SECRET')) {
          // These might have quotes, that's okay
        }
      }
    }
    
    // Check for empty values
    if (trimmed.includes('=') && trimmed.split('=').length === 2) {
      const [key, value] = trimmed.split('=');
      if (!value || value.trim() === '') {
        issues.push(`${key.trim()} has no value`);
      }
    }
  }
});

// Summary
console.log('\n' + '='.repeat(50));
if (missing.length === 0 && issues.length === 0) {
  console.log('✅ All required environment variables are set!');
  console.log('✅ No issues detected!\n');
  process.exit(0);
} else {
  if (missing.length > 0) {
    console.log(`❌ Missing ${missing.length} required variable(s):`);
    missing.forEach(key => console.log(`   - ${key}`));
  }
  if (issues.length > 0) {
    console.log(`\n⚠️  Issues found:`);
    issues.forEach(issue => console.log(`   - ${issue}`));
  }
  console.log('');
  process.exit(1);
}

