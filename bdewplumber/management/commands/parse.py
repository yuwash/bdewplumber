import pdfplumber
from django.core.management.base import BaseCommand, CommandError
from bdewplumber import plumber


class Command(BaseCommand):
    help = "Parse a BDEW edi@energy PDF"

    def add_arguments(self, parser):
        parser.add_argument("file")

    def handle(self, *args, **options):
        filename = options["file"]
        with pdfplumber.open(filename) as pdf:
            tables = list(plumber.extract_mig_tables(pdf))
        print(tables[0], tables[-1])
