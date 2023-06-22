export const extractJSONObjectResponse = (res: string): string | undefined =>
  res.match(/\{(.|\n)*\}/g)?.[0];

export const extractJSONArrayResponse = (res: string): string | undefined =>
  res.match(/\[(.|\n)*\]/g)?.[0];

// given a string in the format of;
// - bullet point 1
// - bullet point 2
// Return an array of bullet point content
export const extractBulletPointsResponse = (res: string): string[] => {
  return res
    .split('\n')
    .map((s) => s.trim().replace('- ', ''))
    .filter((s) => s.length > 0);
};
