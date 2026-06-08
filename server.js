const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// ==========================================
// CRITICAL SETUP: Enable CORS for Frontend
// ==========================================
app.use(cors());
app.use(express.json());

// ==========================================
// IN-MEMORY DATA STORES & SEED DATA
// ==========================================
const dailyIncomeData = [];

// Pre-populated with 4 realistic mock records (Market Vendors with high daily variance)
const flaggedApplications = [
  {
    id: 'APP-001',
    applicantName: 'Jane Muthoni',
    occupation: 'Market Vendor',
    incomeHistory: [
      { date: '2026-06-01', amount: 1500, source: 'Vegetable Sales' },
      { date: '2026-06-02', amount: 4500, source: 'Vegetable Sales' },
      { date: '2026-06-03', amount: 800, source: 'Vegetable Sales' },
      { date: '2026-06-04', amount: 3200, source: 'Vegetable Sales' }
    ],
    metrics: { meanIncome: '2500.00', variancePercentage: '57.90' },
    status: 'Requires Human Review',
    flagReason: 'Income variance is 57.90% (>30%). GUARD protocol activated: No auto-denial for Market Vendor. Flagged for human review.',
    evaluatedAt: '2026-06-05T10:00:00.000Z'
  },
  {
    id: 'APP-002',
    applicantName: 'David Ochieng',
    occupation: 'Market Vendor',
    incomeHistory: [
      { date: '2026-06-01', amount: 2000, source: 'Fruit Sales' },
      { date: '2026-06-02', amount: 6000, source: 'Fruit Sales' },
      { date: '2026-06-03', amount: 1200, source: 'Fruit Sales' }
    ],
    metrics: { meanIncome: '3066.67', variancePercentage: '68.25' },
    status: 'Requires Human Review',
    flagReason: 'High daily income fluctuation detected (68.25% variance). GUARD protocol prevents auto-denial.',
    evaluatedAt: '2026-06-05T11:30:00.000Z'
  },
  {
    id: 'APP-003',
    applicantName: 'Amina Hassan',
    occupation: 'Market Vendor',
    incomeHistory: [
      { date: '2026-06-01', amount: 3000, source: 'Textile Sales' },
      { date: '2026-06-02', amount: 3100, source: 'Textile Sales' },
      { date: '2026-06-03', amount: 8000, source: 'Textile Sales' },
      { date: '2026-06-04', amount: 2900, source: 'Textile Sales' }
    ],
    metrics: { meanIncome: '4250.00', variancePercentage: '54.12' },
    status: 'Requires Human Review',
    flagReason: 'Sudden income spike detected causing >30% variance. Requires manual verification of source.',
    evaluatedAt: '2026-06-05T14:15:00.000Z'
  },
  {
    id: 'APP-004',
    applicantName: 'Peter Kamau',
    occupation: 'Market Vendor',
    incomeHistory: [
      { date: '2026-06-01', amount: 1000, source: 'Poultry Sales' },
      { date: '2026-06-02', amount: 5000, source: 'Poultry Sales' },
      { date: '2026-06-03', amount: 1500, source: 'Poultry Sales' },
      { date: '2026-06-04', amount: 900, source: 'Poultry Sales' }
    ],
    metrics: { meanIncome: '2100.00', variancePercentage: '71.40' },
    status: 'Requires Human Review',
    flagReason: 'Extreme daily variance (71.40%). GUARD protocol activated for human review.',
    evaluatedAt: '2026-06-06T08:00:00.000Z'
  }
];

// ==========================================
// AGENT API ENDPOINTS
// ==========================================

// 1. POST /api/scout
app.post('/api/scout', (req, res) => {
  const { amount, date, source, userId } = req.body;
  
  if (!amount || !date || !source) {
    return res.status(400).json({ error: 'Missing required fields: amount, date, source' });
  }
  
  const newRecord = {
    id: `SCOUT-${Date.now()}`,
    userId: userId || 'unknown',
    amount: parseFloat(amount),
    date,
    source,
    recordedAt: new Date().toISOString()
  };
  
  dailyIncomeData.push(newRecord);
  
  res.status(201).json({ 
    success: true, 
    message: 'Daily income data successfully recorded by Scout agent.',
    data: newRecord
  });
});

// 2. POST /api/evaluate (GUARD Protocol)
app.post('/api/evaluate', (req, res) => {
  const { userId, applicantName, occupation, incomeHistory } = req.body;
  
  if (!userId || !occupation || !incomeHistory || !Array.isArray(incomeHistory) || incomeHistory.length === 0) {
    return res.status(400).json({ error: 'Missing required fields: userId, occupation, incomeHistory (array)' });
  }

  const amounts = incomeHistory.map(d => d.amount);
  const mean = amounts.reduce((a, b) => a + b, 0) / amounts.length;
  
  // Calculate standard deviation and Coefficient of Variation (CV)
  const variance = amounts.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / amounts.length;
  const stdDev = Math.sqrt(variance);
  const coefficientOfVariation = (stdDev / mean) * 100;

  let status = 'Auto-Approved';
  let flagReason = 'Steady income profile with variance under 30%.';

  // GUARD PROTOCOL LOGIC
  if (coefficientOfVariation > 30) {
    status = 'Requires Human Review';
    flagReason = `Income variance is ${coefficientOfVariation.toFixed(2)}% (>30%). GUARD protocol activated: No auto-denial for ${occupation}. Flagged for human review.`;
  }

  const evaluationResult = {
    id: `APP-${Date.now()}`,
    userId,
    applicantName: applicantName || 'Unknown',
    occupation,
    incomeHistory,
    metrics: {
      meanIncome: mean.toFixed(2),
      variancePercentage: coefficientOfVariation.toFixed(2)
    },
    status,
    flagReason,
    evaluatedAt: new Date().toISOString()
  };

  // If flagged, add to the flagged applications array
  if (status === 'Requires Human Review') {
    flaggedApplications.push(evaluationResult);
  }

  res.status(200).json({
    success: true,
    message: 'Evaluation complete.',
    data: evaluationResult
  });
});

// 3. GET /api/flagged
app.get('/api/flagged', (req, res) => {
  // Format response with a summary acting as the 'Pause Point'
  const summary = {
    totalFlagged: flaggedApplications.length,
    pausePointMessage: "ACTION REQUIRED: These applications have been paused by the Guardian agent due to income variance >30%. Please review the daily income fluctuations before making a final lending decision. Auto-denial has been disabled for these profiles per GUARD protocol."
  };

  res.status(200).json({
    success: true,
    summary,
    data: flaggedApplications
  });
});

// Health Check Endpoint (Required for Render monitoring)
app.get('/', (req, res) => {
  res.json({ 
    message: 'Heshima Credit API is running', 
    status: 'healthy',
    timestamp: new Date().toISOString()
  });
});

// Start Server
app.listen(PORT, () => {
  console.log(`✅ Heshima Credit server running on port ${PORT}`);
});
