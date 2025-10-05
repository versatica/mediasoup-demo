export type NotificationNameDataMap<U extends { name: string }> = {
	[K in U as K['name']]: K extends { data: infer D } ? D : undefined;
};

export type RequestNameDataMap<U extends { name: string }> = {
	[K in U as K['name']]: K extends { data: infer D } ? D : undefined;
};

export type RequestNameResponseDataMap<U extends { name: string }> = {
	[K in U as K['name']]: K extends { responseData: infer R } ? R : undefined;
};
