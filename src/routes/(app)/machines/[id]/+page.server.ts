import { error, redirect } from '@sveltejs/kit';
import { requireUser } from '$lib/server/auth/guard';
import { listExercisesForMachine } from '$lib/server/exercises';
import { failFrom, formValues, orNotFound } from '$lib/server/forms';
import {
	deleteMachineSetting,
	getMachine,
	getMachineSetting,
	setMachineArchived,
	updateMachine,
	upsertMachineSetting
} from '$lib/server/machines';
import { parseId } from '$lib/server/validate';
import type { Actions, PageServerLoad } from './$types';

const idOr404 = (param: string) => {
	const id = parseId(param);
	if (id == null) error(404, 'Machine not found');
	return id;
};

export const load: PageServerLoad = async (event) => {
	const user = requireUser(event);
	const id = idOr404(event.params.id);
	try {
		const [machine, setting, exercises] = await Promise.all([
			getMachine(id),
			getMachineSetting(user.id, id),
			listExercisesForMachine(id)
		]);
		return { machine, setting, exercises };
	} catch (e) {
		orNotFound(e);
	}
};

export const actions: Actions = {
	update: async (event) => {
		requireUser(event);
		const values = await formValues(event.request);
		try {
			await updateMachine(idOr404(event.params.id), values);
			return { intent: 'update', message: 'Machine saved' };
		} catch (e) {
			return failFrom(e, { intent: 'update', values });
		}
	},
	saveSetting: async (event) => {
		const user = requireUser(event);
		const values = await formValues(event.request);
		try {
			await upsertMachineSetting(user.id, idOr404(event.params.id), values);
			return { intent: 'setting', message: 'Your setup was saved' };
		} catch (e) {
			return failFrom(e, { intent: 'setting', values });
		}
	},
	clearSetting: async (event) => {
		const user = requireUser(event);
		await deleteMachineSetting(user.id, idOr404(event.params.id));
		return { intent: 'setting', message: 'Your setup was removed' };
	},
	archive: async (event) => {
		requireUser(event);
		try {
			await setMachineArchived(idOr404(event.params.id), true);
		} catch (e) {
			return failFrom(e);
		}
		redirect(303, '/machines');
	},
	restore: async (event) => {
		requireUser(event);
		try {
			await setMachineArchived(idOr404(event.params.id), false);
			return { intent: 'update', message: 'Machine restored' };
		} catch (e) {
			return failFrom(e);
		}
	}
};
