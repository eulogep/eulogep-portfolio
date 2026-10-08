import publicPortfolioJson from '../data/generated/public-portfolio.json';
import { publicPortfolioSchema, type PublicPortfolioView } from '../types/public-portfolio';

const publicPortfolio = publicPortfolioSchema.parse(publicPortfolioJson);

export function getPublicPortfolio(): Readonly<PublicPortfolioView> {
  return publicPortfolio;
}
