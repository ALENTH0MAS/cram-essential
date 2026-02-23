import { v4 as uuidv4 } from 'uuid';
import {
    Decision,
    MeetingAgenda,
    MeetingTurn,
    SDLCStage,
    MeetingType,
} from '../types';
import { Logger } from '../utils/logger';

/** Maps meeting types to SDLC stages for decision categorization */
const MEETING_TO_STAGE: Readonly<Record<MeetingType, SDLCStage>> = {
    [MeetingType.Kickoff]: SDLCStage.Discovery,
    [MeetingType.ArchitectureReview]: SDLCStage.Architecture,
    [MeetingType.SprintPlanning]: SDLCStage.Implementation,
    [MeetingType.CodeReview]: SDLCStage.QualityAssurance,
    [MeetingType.BugTriage]: SDLCStage.QualityAssurance,
    [MeetingType.SEOMarketingReview]: SDLCStage.SEOMarketing,
    [MeetingType.DeploymentReview]: SDLCStage.Deployment,
    [MeetingType.Retrospective]: SDLCStage.Deployment,
};

/**
 * Extracts and tracks decisions made during AI meetings.
 * Parses "DECISION:" markers from conversation turns and records
 * rationale and alternatives discussed.
 */
export class DecisionTracker {
    private readonly logger = Logger.getInstance();
    private readonly allDecisions: Decision[] = [];

    /**
     * Extract decisions from meeting turns.
     * Looks for "DECISION:" markers in turn content.
     */
    extractDecisions(
        meetingId: string,
        turns: readonly MeetingTurn[],
        agenda: MeetingAgenda
    ): readonly Decision[] {
        const decisions: Decision[] = [];
        const stage = MEETING_TO_STAGE[agenda.type] ?? SDLCStage.Discovery;

        for (const turn of turns) {
            const extracted = this.parseDecisionsFromText(turn.message);

            for (const raw of extracted) {
                const decision: Decision = {
                    id: uuidv4(),
                    meetingId,
                    stage,
                    title: raw.title,
                    description: raw.description,
                    rationale: raw.rationale,
                    alternatives: raw.alternatives,
                    madeBy: turn.role,
                    timestamp: turn.timestamp,
                };
                decisions.push(decision);
                this.allDecisions.push(decision);
            }
        }

        if (decisions.length > 0) {
            this.logger.info(`Extracted ${decisions.length} decisions from meeting "${agenda.title}"`);
        }

        return decisions;
    }

    /** Get all decisions tracked across all meetings */
    getAllDecisions(): readonly Decision[] {
        return this.allDecisions;
    }

    /** Get decisions filtered by SDLC stage */
    getDecisionsByStage(stage: SDLCStage): readonly Decision[] {
        return this.allDecisions.filter((d) => d.stage === stage);
    }

    /** Get decisions from a specific meeting */
    getDecisionsByMeeting(meetingId: string): readonly Decision[] {
        return this.allDecisions.filter((d) => d.meetingId === meetingId);
    }

    /**
     * Parse "DECISION:" blocks from a text message.
     * Recognizes patterns like:
     *   DECISION: Use PostgreSQL for the database
     *   Rationale: Best support for JSONB...
     *   Alternatives: MySQL, MongoDB
     */
    private parseDecisionsFromText(
        text: string
    ): Array<{ title: string; description: string; rationale: string; alternatives: string[] }> {
        const results: Array<{ title: string; description: string; rationale: string; alternatives: string[] }> = [];

        // Match "DECISION:" followed by content
        const decisionPattern = /DECISION:\s*(.+?)(?:\n|$)/gi;
        let match: RegExpExecArray | null;

        while ((match = decisionPattern.exec(text)) !== null) {
            const title = match[1].trim();
            const startIndex = match.index + match[0].length;

            // Look for rationale nearby (within next 500 chars)
            const nearby = text.substring(startIndex, startIndex + 500);
            const rationaleMatch = nearby.match(/(?:rationale|reason|because|why):\s*(.+?)(?:\n|$)/i);
            const alternativesMatch = nearby.match(/(?:alternatives?|other options?|instead of):\s*(.+?)(?:\n|$)/i);

            results.push({
                title,
                description: title,
                rationale: rationaleMatch?.[1]?.trim() ?? '',
                alternatives: alternativesMatch
                    ? alternativesMatch[1].split(/[,;]/).map((a) => a.trim()).filter(Boolean)
                    : [],
            });
        }

        return results;
    }
}
