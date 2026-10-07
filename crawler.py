import re
import requests

from bs4 import BeautifulSoup
from datetime import datetime, timedelta, timezone
from urllib.parse import urljoin

from database import save_jobs

BASE_URL = "https://weworkremotely.com"
JOBS_URL = f"{BASE_URL}/remote-jobs"
MULTIPLE_REGIONS = "Vários países"


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


def parse_category(listing):
    section = listing.find_parent("section", class_="jobs")

    if not section:
        return None

    link = section.select_one("h2 a")

    if not link:
        return None

    return link.get_text(" ", strip=True).removesuffix(" Jobs")


def parse_tags(listing):
    # "Featured", "Top 100" e "Boosted" são selos do site e vêm com uma classe
    # modificadora a mais. Só as tags com a classe base descrevem a vaga.
    tags = [
        tag.get_text(" ", strip=True)
        for tag in listing.select(".new-listing__categories__category")
        if len(tag.get("class", [])) == 1
    ]

    if not tags:
        return None, None, None

    job_type = tags[0]
    rest = tags[1:]

    salary_range = rest[0] if rest and rest[0].startswith("$") else None
    regions = rest[1:] if salary_range else rest

    if not regions:
        region = None
    elif len(regions) == 1:
        region = regions[0]
    else:
        region = MULTIPLE_REGIONS

    return job_type, salary_range, region


def parse_posted_at(listing):
    element = listing.select_one(".new-listing__header__icons__date")

    if not element:
        return None

    label = element.get_text(" ", strip=True)
    now = datetime.now(timezone.utc)

    if label == "New":
        return now

    match = re.fullmatch(r"(\d+)d", label)

    if not match:
        return None

    return now - timedelta(days=int(match.group(1)))


def parse_logo(listing):
    element = listing.select_one(".tooltip--flag-logo__flag-logo")

    if not element:
        return None

    match = re.search(r"url\((.+?)\)", element.get("style", ""))

    return match.group(1) if match else None


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

        job_type, salary_range, region = parse_tags(listing)

        job = {
            "title": title,
            "company": company,
            "location": location,
            "url": url,
            "category": parse_category(listing),
            "job_type": job_type,
            "salary_range": salary_range,
            "region": region,
            "posted_at": parse_posted_at(listing),
            "company_logo": parse_logo(listing)
        }

        jobs.append(job)

    return jobs


def run_crawler():

    html = get_html()

    jobs = parse_jobs(html)

    print(f"Vagas encontradas: {len(jobs)}")

    if not jobs:
        print("Nenhuma vaga encontrada.")
        return

    inserted = save_jobs(jobs)

    print(f"Novas vagas inseridas: {inserted}")
    print("Dados salvos no MongoDB.")
