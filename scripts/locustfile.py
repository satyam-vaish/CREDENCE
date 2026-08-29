from locust import HttpUser, between, task

BASE = {
    "annual_inc": 62000,
    "dti": 18,
    "int_rate": 12.5,
    "loan_amnt": 15000,
    "revol_util": 34,
    "delinq_2yrs": 0,
    "emp_length": 5,
    "grade": "C",
    "term": 36,
    "credit_age": 9,
    "home_ownership": "RENT",
    "purpose": "debt_consolidation",
}


class ApiUser(HttpUser):
    wait_time = between(0.1, 0.5)

    @task(6)
    def predict(self):
        self.client.post("/predict", json=BASE)

    @task(3)
    def whatif(self):
        self.client.post("/whatif", json={"base": BASE, "feature": "dti", "value": 30})

    @task(1)
    def health(self):
        self.client.get("/health")
