import requests

from bs4 import BeautifulSoup
from urllib.parse import urljoin

from database import save_jobs

BASE_URL = "https://weworkremotely.com"
JOBS_URL = f"{BASE_URL}/remote-jobs"


def get_html():
    print(f"Coletando: {JOBS_URL}")

    response = requests.get(
        JOBS_URL,
        headers={
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/153.0.0.0 Safari/537.36"
            ),
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
        },
        timeout=30
    )

    print("Status:", response.status_code)

    response.raise_for_status()

    return response.text


def parse_jobs(html):
    soup = BeautifulSoup(html, "html.parser")

    jobs = []

    listings = soup.select("li.new-listing-container")

    print(f"Elementos encontrados: {len(listings)}")

    for listing in listings:

        # Ignora anúncios
        if "listing-ad" in listing.get("class", []):
            continue

        link = listing.select_one(
            "a.listing-link--unlocked"
        )

        title_element = listing.select_one(
            ".new-listing__header__title__text"
        )

        company_element = listing.select_one(
            ".new-listing__company-name"
        )

        location_element = listing.select_one(
            ".new-listing__company-headquarters"
        )

        if not link or not title_element:
            continue

        title = title_element.get_text(
            " ",
            strip=True
        )

        company = (
            company_element.get_text(" ", strip=True)
            if company_element
            else None
        )

        location = (
            location_element.get_text(" ", strip=True)
            if location_element
            else None
        )

        url = urljoin(
            BASE_URL,
            link.get("href")
        )

        job = {
            "title": title,
            "company": company,
            "location": location,
            "url": url
        }

        jobs.append(job)

    return jobs


def main():

    html = get_html()

    jobs = parse_jobs(html)

    print(f"Vagas encontradas: {len(jobs)}")

    if not jobs:
        print("Nenhuma vaga encontrada.")
        return

    inserted = save_jobs(jobs)

    print(f"Novas vagas inseridas: {inserted}")
    print("Dados salvos no MongoDB.")


if __name__ == "__main__":
    main()