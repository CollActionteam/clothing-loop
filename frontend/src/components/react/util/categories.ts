import { Categories, Sizes } from "../../../api/enums";

type ICategories = Record<Categories, Sizes[]>;

const clothingCategories: ICategories = {
  [Categories.children]: [
    Sizes["baby"],
    Sizes["1To4YearsOld"],
    Sizes["5To12YearsOld"],
  ],
  [Categories.women]: [
    Sizes["womenSmall"],
    Sizes["womenMedium"],
    Sizes["womenLarge"],
    Sizes["womenPlusSize"],
    Sizes["womenMaternity"],
  ],
  [Categories.men]: [
    Sizes["menSmall"],
    Sizes["menMedium"],
    Sizes["menLarge"],
    Sizes["menPlusSize"],
  ],
  [Categories.books]: [],
  [Categories.toys]: [],
};

export const allSizes = Object.values(clothingCategories).reduce(
  (prev, current) => prev.concat(current),
);

export default clothingCategories;
