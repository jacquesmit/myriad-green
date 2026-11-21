'use strict';

// Read-only live comparison with canonical MAGOS Agent Job Allocation Matrix.
// No write permission, no agent activation, no side effects beyond Sheets reads.
const { google } = require('googleapis');
const { createGoogleAuth } = require('../adapters/google-auth');
const snapshot = require('../rules/agent-allocation.snapshot.v1.json');
const DEFAULT_ID = '1FKj-iudwat5bbFIrplgg237-ABPRq3ijQulf-LbSuBs';
const READ_SCOPE='https://www.googleapis.com/auth/spreadsheets.readonly';

function normalized(v) { return String(v??'').trim(); }
function supportIds(s) { return normalized(s).split(',').map(x=>x.trim()).filter(Boolean); }

class LiveAgentAuthority {
  constructor({ spreadsheetId=process.env.MAGOS_AGENT_MATRIX_SPREADSHEET_ID||DEFAULT_ID,
    sheets,auth }={}) {
    this.spreadsheetId=spreadsheetId;
    this.sheets=sheets || google.sheets({
      version:'v4',auth:auth||createGoogleAuth([READ_SCOPE])
    });
  }
  async inspect(jobTypeId) {
    const job_type_id=normalized(jobTypeId).toUpperCase();
    if(!/^JT-\d{3}$/.test(job_type_id)) {
      return {verified:false,reason:'INVALID_JOB_TYPE',job_type_id};
    }
    try {
      const response=await this.sheets.spreadsheets.values.batchGet({
        spreadsheetId:this.spreadsheetId,
        ranges:["'Allocation Matrix'!A1:K100","'Agent Registry'!A1:I100","'Job Types'!A1:I100"]
      });
      const [matrix,registry,jobTypes]=(response?.data?.valueRanges||[]).map(x=>x.values||[]);
      const validMatrix=matrix?.[0]?.[0]==='Job_Type_ID' &&
        matrix?.[0]?.[1]==='Primary_Agent_ID';
      const validRegistry=registry?.[0]?.[0]==='Agent_ID';
      const validJobTypes=jobTypes?.[0]?.[0]==='Job_Type_ID' && jobTypes?.[0]?.[6]==='Primary_Agent_ID';
      if(!validMatrix||!validRegistry||!validJobTypes) {
        return {verified:false,reason:'CANONICAL_SCHEMA_MISMATCH',job_type_id};
      }
      const matches=matrix.slice(1).filter(r=>normalized(r[0])===job_type_id);
      if(matches.length!==1) {
        return {verified:false,reason:'OWNER_MISSING_OR_DUPLICATED',job_type_id};
      }
      const [row]=matches;
      const owner_agent_id=normalized(row[1]);
      const agents=registry.slice(1).filter(r=>normalized(r[0])===owner_agent_id);
      const typeMatches=jobTypes.slice(1).filter(r=>normalized(r[0])===job_type_id);
      if(typeMatches.length!==1 || normalized(typeMatches[0][6])!==owner_agent_id) {
        return {verified:false,reason:'JOB_TYPE_OWNER_CONFLICT',job_type_id};
      }
      if(agents.length!==1) {
        return {verified:false,reason:'AGENT_MISSING_OR_DUPLICATED',job_type_id};
      }
      const snap=snapshot.jobs.find(x=>x.job_type_id===job_type_id);
      const liveSupport=supportIds(row[2]);
      const snapshot_matches_current=Boolean(snap &&
        snap.primary_agent_id===owner_agent_id &&
        JSON.stringify([...snap.support_agent_ids].sort())===JSON.stringify([...liveSupport].sort()) &&
        snap.human_approval===normalized(row[8]) &&
        snap.registered_only===normalized(row[10]).includes('REGISTRATION_ONLY'));
      return {
        verified:true,job_type_id,owner_agent_id,
        supporting_agent_ids:liveSupport,
        registration_only:normalized(row[10]).includes('REGISTRATION_ONLY'),
        human_approval:normalized(row[8]),
        snapshot_matches_current,
        // Still no runtime capability assignment, scoped access-control
        // approval, or authoritative source freshness check in this read.
        permissions_verified:false,
        source_freshness_verified:false,
        authority:'CANONICAL_DRIVE_READ_ONLY'
      };
    } catch {
      return {verified:false,reason:'CANONICAL_READ_FAILED',job_type_id};
    }
  }
}
module.exports={LiveAgentAuthority};
