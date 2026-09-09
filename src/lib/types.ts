/** Shape shared by every form action result so pages can read it uniformly. */
export interface FormResult {
	/** Which form produced this result (pages with several forms). */
	intent?: string;
	/** Record the form targeted (block id, set id…). */
	id?: number;
	/** Success feedback shown as a toast. */
	message?: string;
	/** Field-level validation errors keyed by input name. */
	errors?: Record<string, string>;
	/** Submitted values, echoed back so inputs keep what the user typed. */
	values?: Record<string, string>;
}
