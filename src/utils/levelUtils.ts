// Level up calculations
export const BASE_EXP = 100;
export const BASE_ZGOLD = 50;

export const calculateRequiredExp = (currentLevel: number): number => {
  return Math.floor(BASE_EXP * (currentLevel ** 2));
};

export const calculateRequiredZGold = (currentLevel: number): number => {
  return Math.floor(BASE_ZGOLD * (currentLevel ** 1.5));
};

export const calculateStrengthIncrease = (level: number): number => {
  return Math.floor(5 + (level / 10) * 10);
}